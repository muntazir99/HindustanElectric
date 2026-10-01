
import logging
import pandas as pd
from prophet import Prophet
from datetime import datetime
from ..db_config import get_db

logger = logging.getLogger(__name__)

class ForecastingEngine:
    def __init__(self):
        self.db = get_db()
        self.logs_collection = self.db["logs"]

    def predict_demand(self, item_name, company, periods=30):
        """
        Predicts demand for a specific item for the next 'periods' days.
        """
        try:
            # 1. Fetch Sales History for the Item
            # We match by Name + Company as that's how logs are currently structured.
            # Ideally logs would have item_id, but current logs use name/company.
            query = {
                "action": "sell",
                "item_name": item_name,
                "company": company
            }
            
            # Retrieve only necessary fields
            cursor = self.logs_collection.find(query, {"timestamp": 1, "quantity_sold": 1, "quantity": 1})
            
            # Convert to List
            sales_data = []
            for doc in cursor:
                qty = doc.get("quantity_sold") or doc.get("quantity") or 0
                sales_data.append({
                    "ds": doc["timestamp"],
                    "y": float(qty)
                })

            if len(sales_data) < 5:
                # Prophet needs at least a few data points to generally work without erroring,
                # though technically 2 is minimum, results are trash. 5 is a safe heuristic.
                return {
                    "success": False, 
                    "message": "Not enough historical sales data to forecast (need at least 5 transactions)."
                }

            # 2. Prepare DataFrame
            df = pd.DataFrame(sales_data)
            
            # Aggregate by Day (summing sales if multiple sales happened in one day)
            df['ds'] = pd.to_datetime(df['ds']).dt.normalize() # Remove time component
            df = df.groupby('ds').sum().reset_index()

            # 3. Train Prophet Model
            # interval_width=0.95 gives us a confidence interval
            m = Prophet(interval_width=0.95, daily_seasonality=False, yearly_seasonality=False)
            m.add_seasonality(name='weekly', period=7, fourier_order=3) # Assume weekly patterns matter
            m.fit(df)

            # 4. Make Future Dataframe
            future = m.make_future_dataframe(periods=periods)
            forecast = m.predict(future)

            # 5. Extract Results
            # We want the last 'periods' days (the prediction part)
            # But let's return a mix of historical + future for the chart
            
            # Format for frontend: date string and value
            result_data = []
            
            # Add History
            # df has 'ds' and 'y'
            history_map = {row['ds'].strftime("%Y-%m-%d"): row['y'] for _, row in df.iterrows()}
            
            for _, row in forecast.iterrows():
                date_str = row['ds'].strftime("%Y-%m-%d")
                
                # yhat is the prediction value. 
                # Prophet can predict negative numbers, we clamp to 0.
                prediction = max(0, row['yhat'])
                
                is_history = date_str in history_map
                actual_value = history_map.get(date_str, None)

                result_data.append({
                    "date": date_str,
                    "prediction": round(prediction, 1),
                    "actual": actual_value,
                    "is_future": not is_history
                })

            total_predicted_demand = sum(item['prediction'] for item in result_data if item['is_future'])

            return {
                "success": True,
                "data": result_data,
                "summary": {
                    "total_predicted_demand_next_30_days": round(total_predicted_demand, 0),
                    "trend": "increasing" if result_data[-1]['prediction'] > result_data[0]['prediction'] else "decreasing"
                }
            }

        except Exception as e:
            logger.error(f"Forecasting error for {item_name}: {str(e)}")
            return {"success": False, "message": str(e)}
