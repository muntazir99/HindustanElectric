# Hindustan Electric — App Handbook

How to do every job in the shop app, step by step. Written for the people who use it (owner and staff) and for
the help assistant, which answers questions from this file.

Matches the app as of **3 October 2026**. **Rule for changes:** any change to a screen, button or rule updates
this handbook in the same commit.

---

## 0. For the help assistant — read first

1. **Answer only from this handbook.** If something isn't covered, say so plainly and suggest asking the owner.
   Never invent buttons, screens, prices, rules or shortcuts.
2. **Reply in the asker's language and script.** A Hinglish question ("estimate kaise banate hai") gets a Hinglish
   answer in English letters. Hindi in Devanagari gets Devanagari. English gets English. Keep button and screen
   names exactly as written here, in English and in **bold**, because that is how they appear in the app.
3. **Give numbered steps** from where the person starts (usually **Home**), naming every button in order. Don't
   skip a step because it seems obvious. Mention what the app shows when it's done.
4. **Say who can do it.** Each topic lists the switch it needs. If the asker may not have it, add: "If you don't
   see this button, ask the owner to switch on *<switch name>* for you."
5. **Explain what happens** to stock, khata and money, so people know the result of the action.
6. **Never ask for or repeat passwords.** For a forgotten password: "Ask the owner to set a new one."
7. **Keep it short.** Steps first, then at most two lines of "good to know".

---

## 1. Words used in the app

| Word | Meaning |
|---|---|
| **Bill** | A sale. Numbered like `HE/26-27/00001` (shop prefix / financial year / number). |
| **Udhaar / Khata** | Money a customer owes the shop. Each customer's khata is their running account. |
| **Estimate** | A price quote (quotation) for a customer, numbered `QT/26-27/00001`. Changes nothing in stock or khata. |
| **Kept for later** | A bill paused before saving (customer went to get more items). Reopen it any time. |
| **Return / Credit note** | Goods coming back from a bill. Makes a credit note `CN/26-27/00001`. |
| **Receipt** | Proof of an udhaar payment, numbered `RC/26-27/00001`. |
| **Unit / Sold in** | The smallest unit an item is sold in: Piece, Metre, Foot, Kilogram, Litre, Set, Pair, Packet, Roll. Stock is kept in this unit. |
| **Pack** | A bigger unit of the same item, e.g. a **coil** of 90 m wire or a **box** of 20 switches. A pack can have its own barcode and price. |
| **Variant** | A size or colour of one product, e.g. "1.5 sq mm Red". |
| **Item code** | A short number every item gets (e.g. `#10038`). Use it to type an item that has no barcode. |
| **Rack** | Where an item is kept, e.g. `A3`. |
| **Min stock** | When stock falls to this, the item shows as **Running low**. |
| **Not checked yet** | The item's shelf stock hasn't been counted in the app yet, so the stock number isn't confirmed. |
| **Check again** | Stock went below zero (more sold than the app knew), so the shelf should be counted again. |
| **Goods Arrived / Purchase bill** | A distributor's bill entered in the app. Stock goes up when it's added to stock. |
| **Distributor** | A supplier the shop buys from. |
| **Switches** | What each staff member is allowed to do. The owner turns them on or off in **Staff & Access**. |
| **Back office** | The owner's advanced settings screen (shop details, all records). |

---

## 2. Who can do what (switches)

The **owner** can do everything. Each **staff** member can do only what their switches allow. Changes apply at
once.

| Switch | What it allows |
|---|---|
| **Make bills** | New Bill, keep for later, estimates, udhaar on a bill |
| **Take udhaar payments** | Take Payment, print receipts |
| **Enter goods arrived** | Goods Arrived, purchase bills, distributors |
| **Add new items** | Add New Item, sizes and colours, barcodes |
| **Count stock** | Check Stock: counting only (the owner saves it to stock) |
| **See old bills** | Old Bills, Kept for Later, Estimates, reprint |
| **See khata** | Customers, who owes what, statements |
| **See today's sales and cash** | The money numbers on Home |
| **Returns and cancellations** | Return goods, refunds, cancel a bill or receipt |
| **Change prices and items** | Prices, HSN/GST, switch items off, pack sizes, Update Prices |
| **Fix stock** | Fix Stock, save or cancel a stock check |
| **Udhaar control** | Credit limits, discounts, old udhaar, correct khata, allow over-limit udhaar |
| **Allow low prices** | Bill below cost (with a warning) |
| **Upload from Excel** | Add many items at once |
| **See costs and profit** | Cost price, stock value |

Quick sets when adding staff: **Counter** = Make bills, Take udhaar payments, See old bills.
**Store** = Enter goods arrived, Add new items, Count stock.

If a button or screen is missing for someone, they don't have that switch.

---

## 3. Getting around

### G1. Log in and log out
**Words people use:** login kaise kare, password bhool gaya, logout, लॉगिन, पासवर्ड
**Who:** everyone.
1. Open the shop's app address in the browser (on the counter PC or a phone).
2. Type your **Username** and **Password**, then press **Log in**.
3. To log out: on a PC, click your name at the top right, then **Log out**. On a phone, open **More** (the grid
   button at the top) and press **Log out** at the bottom.

Good to know:
- A login lasts one shop day (12 hours). After a long time away the app asks you to log in again: *"You were
  logged out after a long time away."*
- **Forgot your password?** Staff can't reset it themselves. Ask the owner to set a new one (see O2).
- Too many tries in a short time shows *"Too many tries. Wait a minute, then try again."* Wait a minute.

### G2. Moving around the app
**Words people use:** home kaise jaye, back, menu, sab options kahan hai
**Who:** everyone.
- **Top bar (on every screen):** **Home**, the green **New Bill**, and **More** (the grid button: every other
  screen). On a PC there is also **Find an item** (search). On a phone, a **scan** button next to Home scans any
  item to show its details.
- **Under the top bar:** "Home › this page". If you came from another screen, **← Back to …** on the right takes
  you back there.
- **Home** shows big buttons for daily jobs (New Bill, Goods Arrived, Take Payment, Add New Item, Check Stock;
  only the ones you may use), today's figures, recent bills, udhaar to collect, things that need attention, and
  links to other screens.
- **More** (All options) lists everything else, in groups: **Bills**, **Items & stock**, **Buying from
  distributors**, **Khata**, **Setup**.

### G3. Scanning barcodes (scanner or phone camera)
**Words people use:** barcode scan, scanner, camera se scan, QR, बारकोड
**Who:** everyone (on screens they can use).
- **USB barcode scanner (counter PC):** click in the scan box and scan. The scanner types the code and presses
  Enter by itself.
- **Phone camera:** tap the **camera** icon inside the scan box. Allow the camera the first time. Hold the
  barcode **15–20 cm away**, tap the picture to focus, use **2×** to zoom, **Light** in a dark rack, and
  **Switch camera** if the picture stays blurry. **Done** closes it.
  - On **New Bill**, **Goods Arrived** and **Check Stock** the camera stays on for the next item. To scan the
    same item again, point away and back.
  - On **Fix Stock** and in the top-bar search it closes after one item.
- **See any item's details:** on a phone, tap the **scan** button next to **Home** and scan it. The item's page
  opens (price, stock, rack, pack sizes).
- **Barcode boxes** (Add New Item, Add pack, New item on Goods Arrived) also have a camera icon to fill in the
  barcode. If another item already has that barcode, it says *"Already used by …"*.
- **Items without a barcode:** type the item's code (e.g. `10038`) or name instead.

### G4. Find an item and its price or stock
**Words people use:** rate kya hai, price check, stock kitna hai, item dhundo, saman kahan rakha hai
**Who:** everyone.
1. **PC:** type the name, brand, size or code in **Find an item** at the top and pick it.
   **Phone:** tap the **scan** button next to **Home** and scan the barcode, or go to **More → All Items** and
   search.
2. The item's page shows **Price**, **MRP**, **In stock** (or "Not checked yet"), **Rack**, category, HSN, GST,
   pack sizes with their barcodes and prices, and the stock history. Average cost shows only with **See costs and
   profit**.

Search also finds **other names** customers use (e.g. "pankha" for fan) if they were added to the item.

### G5. Ask for help in the app
**Words people use:** help, madad, sawaal poochna, kaise kare samajh nahi aa raha, मदद
**Who:** everyone.
1. Press the round **?** button at the bottom right of any screen.
2. Type your question in Hindi, Hinglish or English (e.g. "estimate kaise banate hai") and press the send arrow.
   Or press the **mic**, choose **हिंदी** or **English** under **Speaking in**, and speak.
3. The answer comes as numbered steps, with button names in **bold** and a progress bar ("Step 1 of 4").
4. Follow the steps while using the app:
   - **Open …** on a step goes to the screen it names. The help stays open, and the step says **You're here**.
   - **Show me** outlines the button the step names on the screen.
   - **Done, next step** moves on.
5. **Read aloud** speaks the answer. **Handbook: …** shows the part of this handbook it came from.

On the counter PC, Help stays open as a panel on the right while you work, and the page moves over to make room.
On a phone, it opens from the bottom. **Follow these steps** (or the down arrow) shrinks it to a one-line step bar
with back, next, and an up arrow to open it again. The **?** button shows which step you're on (e.g. 3/4) while
Help is closed. **×** ends the steps.

If the answer isn't right, try other words, or ask the owner. The mic works in Chrome or Edge. At most 30
questions an hour per person.

---

## 4. Billing (sales)

### B1. Make a bill (cash or UPI sale)
**Words people use:** bill banana, naya bill, bill kaise banaye, parchi kaatna, बिल बनाना
**Who:** **Make bills**.
1. Press the green **New Bill** (top bar or Home).
2. Scan each item, or type its name or code in **Scan the barcode, or type the item name** and pick it. Scanning
   the same item again adds one more.
3. Check each line: **Qty** (− / +, or type, e.g. 2.5 for metres), **Price ₹** and **Disc %**. The **Amount**
   updates by itself. 🗑 removes a line.
4. Leave **Who is buying?** empty for a walk-in cash customer.
5. Under **How are they paying?** choose **Cash** or **UPI** (or **Card**).
6. Press **Save & Print Bill** (or **F9**). The bill gets its number and the A4 print opens. Print it, then
   **Back to New Bill**.

What happens: stock goes down, the payment is recorded, and the bill appears in **Old Bills**.

Good to know:
- **Save without printing** (under the green button) saves it and shows a **Print** link to use later.
- Keyboard on the PC: **F2** item box · **F4** customer · **F8** keep for later · **F9** save & print.
- If the shop's UPI ID is set and the bill has an unpaid (udhaar) amount, the printed bill shows a UPI QR code for
  that amount.

### B2. Bill on udhaar (khata) for a customer
**Words people use:** udhaar pe bill, khate mein likho, credit pe dena, baad me dega, उधार
**Who:** **Make bills**.
1. Make the bill as in B1, steps 1–3.
2. In **Who is buying?** type the customer's name or phone and pick them. It shows what they already owe and
   their limit. New customer? Choose **Add "name" as a new customer**.
3. Under **How are they paying?** choose **Udhaar**. It shows **Goes on udhaar: ₹…**.
4. Press **Save & Print Bill**.

What happens: the full amount is added to the customer's khata.

If something goes wrong:
- *"To give udhaar, choose who is buying"*: udhaar always needs a customer. Pick one in **Who is buying?**.
- *"… would owe ₹…, over their credit limit … Ask the owner."*: the customer would cross their limit. Only
  someone with **Udhaar control** can still save it (they see a warning).

### B3. Part payment (some now, rest on udhaar)
**Words people use:** kuch paisa abhi, baaki udhaar, aadha cash aadha UPI, split payment
**Who:** **Make bills**.
1. Make the bill (B1, steps 1–3) and choose the customer in **Who is buying?**.
2. Under **How are they paying?** choose **Part payment**.
3. Enter how much came in as **Cash**, **UPI** and **Card**. Anything left goes on udhaar (shown as **Goes on
   udhaar**).
4. Press **Save & Print Bill**.

Good to know:
- Enter the amount **paid towards the bill**, not the note the customer handed over. If they give ₹500 for a
  ₹460 bill, enter ₹460 and give ₹40 change.
- Fully paid in two ways (e.g. part cash, part UPI) works the same way; nothing is left for udhaar.
- If something is left unpaid and no customer is chosen, it says *"₹… is unpaid. Choose a customer…"*.

### B4. Change quantity, price or discount on a bill
**Words people use:** rate kam karna, discount dena, quantity badalna, chhoot
**Who:** **Make bills** (selling below cost needs **Allow low prices**).
- **Quantity:** − / + or type it.
- **Price of one line:** type in **Price ₹**. Prices include GST unless **Prices include GST** is unticked (under
  **Buyer's name, address, GSTIN, other state…**).
- **Discount on one line:** type a % in **Disc %**.
- **Discount on the whole bill:** under **To pay**, type rupees in **Discount on whole bill (₹)**.
- **Customer's fixed discount:** if a customer has **Discount on every bill (%)**, it is filled in on each line
  automatically when you choose them. You can still change it.

If something goes wrong:
- Line turns red, *"Price too low — ask the owner"*: the price is below what the item cost the shop. Only someone
  with **Allow low prices** can bill it (they see *"Below cost — allowed for you, with a warning"*).
- *"… has no selling price. Type the rate."*: the item has no price yet. Type it in **Price ₹**, and tell the
  owner so it can be set on the item.

### B5. Selling a full pack (coil, box) or loose
**Words people use:** poora coil, dabba, box wala rate, meter me bechna
**Who:** **Make bills**.
1. Scan the **pack's own barcode** (e.g. the coil's) and the line is set to that pack with its price.
2. Or add the item, then pick the pack in the small box under the item's name (e.g. **coil (90 m)**). The price
   changes to the pack price, unless you typed a price yourself.

Stock is always counted in the smallest unit: one coil of 90 m takes 90 m off stock.

### B6. Stock warning on a bill
**Words people use:** stock nahi dikha raha, stock kam bata raha
**Who:** **Make bills**.
- *"More than the stock shows — check the shelf"*: the app thinks there's less on the shelf than you're selling.
  The bill can still be saved. Check the shelf; if the app's number is wrong, the owner fixes it with a stock
  check (S1) or **Fix stock** (S3).
- *"shelf stock not checked yet"*: this item hasn't been counted in the app yet. Billing works normally.

### B7. Buyer details, GSTIN, another state, notes
**Words people use:** GST bill, GST wala bill, pakka bill, GSTIN dalna, dusre state ka customer, address, IGST, जीएसटी बिल
**Who:** **Make bills**.
1. On New Bill, under **Who is buying?**, press **Buyer's name, address, GSTIN, other state…**.
2. For a walk-in buyer (no customer chosen), fill **Buyer name**, **Buyer phone**, **Buyer address**, **Buyer
   GSTIN**. A chosen customer's saved details are used automatically.
3. **Goods going to (state):** change it only when the goods go to another state. Then IGST applies instead of
   CGST + SGST.
4. **Note on bill:** any note to print on the bill.

Good to know: for a bill **above ₹50,000** to a walk-in buyer, GST rules need their **name and address**. The app
won't save it without them.

### B8. Keep a bill for later, and open it again
**Words people use:** bill hold karna, baad me pura karna, customer abhi aayega, rok ke rakhna
**Who:** **Make bills**.
1. On New Bill, press **Keep for later** (or **F8**). The screen clears for the next customer.
2. To open it again: press **Kept for later (N)** at the top of New Bill and pick the bill. It comes back as it
   was.

Good to know:
- If the current bill has items when you open a kept one, the current one is kept for later first. Nothing is
  lost.
- Kept bills also show in **More → Kept for Later**. Nothing changes in stock until a bill is saved.

### B9. Start over (clear the bill)
**Words people use:** bill saaf karna, sab hata do, naya shuru, clear bill
**Who:** **Make bills**.
Press **Start over** at the bottom of New Bill and confirm. Everything on the bill being made is cleared. Saved
bills are never affected.

### B10. Make an estimate (quotation)
**Words people use:** estimate kaise banate hai, quotation, rate bata do likh ke, kotation, अनुमान
**Who:** **Make bills**.
1. Open **New Bill** and add the items, quantities, prices and discount as usual.
2. Optionally add the buyer under **Who is buying?** or **Buyer's name, address, GSTIN, other state…**.
3. Press **Make estimate** (bottom, middle button).
4. The estimate gets a number like `QT/26-27/00001` and opens for printing. It's headed **QUOTATION**, says
   *"Not a tax invoice"* and shows **Valid until** (15 days).

What happens: nothing in stock or khata. An estimate can't be changed. For changes, make a new one.

### B11. Turn an estimate into a bill
**Words people use:** estimate se bill banana, quotation wala saman le gaya
**Who:** **Make bills** (finding old estimates needs **See old bills**).
1. **More → Estimates** (or **Old Bills**, then **Kind → Estimates**). Open the estimate.
2. Press **Make it a bill**. New Bill opens with the same items, the **quoted prices**, discount and buyer, and
   the note *"As per quotation QT/…"*.
3. Change anything needed, choose how they're paying, and press **Save & Print Bill**.

The estimate then shows **Billed as HE/…**. One estimate can be billed only once.

### B12. Find an old bill and reprint it
**Words people use:** purana bill, bill dobara print, kal ka bill, bill dhundo
**Who:** **See old bills**.
1. **More → Old Bills** (or **All bills** on Home).
2. Use **Show → Day** (**Today**, **Yesterday**, **Any day**, or pick a date) and **Kind** (**Bills**, **Kept
   for later**, **Estimates**, **Cancelled**). Or type a bill number, name or phone in the search and press
   Enter.
3. Open the bill and press **Print**.

The list shows the day's total at the top.

### B13. Return goods (customer brings items back)
**Words people use:** saman wapas, return lena, maal lautana, paisa wapas, वापसी
**Who:** **Returns and cancellations**.
1. **More → Return Goods** (or Old Bills). Find the bill the goods were sold on and open it.
2. Press **Return goods**.
3. For each item coming back, enter how much in **Returning** (it shows what was sold and what can still be
   returned).
4. Choose how the money goes back: **Cash back**, **UPI back**, or **Credit to khata** (only if the bill was made
   out to a customer).
5. Write a **Reason** (e.g. "unused material returned by electrician") and save.
6. A credit note (`CN/26-27/…`) is made and opens for printing.

What happens: the goods go back into stock, GST is reversed at the bill's own rates, and the money goes back as
chosen (or comes off the customer's udhaar).

### B14. Cancel a bill
**Words people use:** bill cancel, galat bill, bill radd karna
**Who:** **Returns and cancellations**.
1. **More → Cancel a Bill** (or Old Bills). Find and open the bill.
2. Press **Cancel bill**, write a **Reason**, and confirm with **Cancel bill**.

What happens: all goods go back into stock, payments are recorded as refunded (give the money back), and any
udhaar from it is reversed. The bill number stays, marked **Cancelled**.

Good to know: a bill that already had goods returned can't be cancelled. Return the rest instead (B13).

---

## 5. Khata (udhaar)

### K1. Add a customer
**Words people use:** naya customer, grahak jodna, electrician add karna
**Who:** **See khata** or **Take udhaar payments** (or from New Bill with **Make bills**).
1. **More → Customers** (Khata), then **Add customer**. Or, on New Bill, type the name in **Who is buying?** and
   choose **Add "name" as a new customer**.
2. Fill **Name** (needed), **Phone**, **Type** (Retail, Electrician, Contractor, Business), **GSTIN** (registered
   businesses only), **Address**, **Notes**.
3. With **Udhaar control** there are also **Credit limit (₹)** (blank = no limit, 0 = no udhaar allowed) and
   **Discount on every bill (%)** (e.g. an electricians' discount).

### K2. See who owes what
**Words people use:** kiska kitna baaki, udhaar list, khata dekhna, kaun paisa dega
**Who:** **See khata** (with only **Take udhaar payments**: the list without the totals).
1. **More → Customers** (or **Khata** on Home). The **Udhaar** box shows **You will get** (total owed),
   **Received today** and **Given on udhaar today**.
2. Choose **Owe money** to see only those who owe. Search by name or phone.
3. Open a customer to see their full khata: every bill, payment and correction, with **You gave**, **You got**
   and **Owes**.

### K3. Take an udhaar payment (and give a receipt)
**Words people use:** udhaar wapas, udhaar ka paisa lena, paisa le liya, paisa jama karna, payment lena, payment aaya, khata clear, रसीद, बकाया जमा
**Who:** **Take udhaar payments**.
1. Press **Take Payment** on Home (it lists who owes), then pick the customer. Or open the customer and press
   **Take Payment**.
2. Enter **Amount received (₹)**. It starts with the full amount owed.
3. Choose **Paid by**: **Cash**, **UPI**, **Card**, **Bank** or **Cheque**. Add a **Reference** (UPI transaction
   ID, cheque number) and **Note** if useful.
4. Press **Save & make receipt**. The next screen shows what's still due. Press **Print receipt** to print it.

Good to know: if the amount is **more** than they owe, the app asks you to confirm. The extra is kept as an
**advance** (press **Yes, keep the advance**). Their next bills use it up.

### K4. Cancel a receipt entered by mistake
**Words people use:** receipt galat, galat receipt ban gayi, receipt cancel, payment galti se, रसीद रद्द
**Who:** **Returns and cancellations**.
1. Open the customer. In their khata, next to the payment, press **cancel receipt**.
2. Write a **Reason** and press **Cancel receipt**.

The receipt is marked cancelled and the udhaar goes back up by that amount. Nothing is deleted.

### K5. Enter old udhaar from the paper register
**Words people use:** purana udhaar, register wala baaki, pichla hisaab, opening balance
**Who:** **Udhaar control**.
1. Open the customer (add them first if needed, K1).
2. Under **Corrections**, press **Add old udhaar from the register**.
3. Enter what they owed in the paper khata when the shop started using the app, and save.

Can be added **once** per customer. To change it later, use **Correct the khata** (K6).

### K6. Correct a customer's khata
**Words people use:** khata galat hai, hisaab sudharna, galti theek karna
**Who:** **Udhaar control**.
1. Open the customer and press **Correct the khata** (under **Corrections**).
2. Enter the amount: **positive** if they owe **more**, **negative** if they owe **less** (or to give an advance).
3. Write the **Reason** (needed) and save.

Only for mistakes. Bills and payments update the khata by themselves. Every correction is recorded with the
reason.

### K7. Print a customer's khata statement
**Words people use:** khata print, hisaab ki copy, statement dena
**Who:** **See khata**.
1. Open the customer and press **Print khata**.
2. For a period, first set **From** / **To** in the **History** box. The statement then starts with "Owed before
   …".

The printout is a compact A4 statement: shop name, **KHATA STATEMENT**, customer, period, each entry (Bill amount,
Paid, Balance) and **Balance due**.

### K8. Edit a customer
**Words people use:** customer edit, naam badalna, phone number badalna, limit badhana, customer ki jankari
**Who:** **See khata** or **Udhaar control**.
Open the customer and press **Edit details**. The credit limit and fixed discount can only be changed with
**Udhaar control**.

---

## 6. Items and prices

### I1. Add a new item (one product with its sizes and colours)
**Words people use:** naya item, naya saman jodna, product add karna, size colour wala item
**Who:** **Add new items** (prices on later edits need **Change prices and items**).
1. Home → **Add New Item** (or **More → Add New Item**).
2. **Product:** **Brand** (blank if unbranded), **Product name** (needed), **Category** (+ to make a new one),
   **HSN code** (4, 6 or 8 digits), **GST %**, **Sold in** (the smallest unit you sell, e.g. Metre for wire,
   Piece for switches).
3. If it also comes in packs, tick **Also bought or sold in packs** and fill **Pack name** (e.g. coil, box) and
   how many units are in one pack (e.g. 90 m in one coil).
4. **Sizes and colours:** type the sizes (e.g. "1 sq mm, 1.5 sq mm") and/or colours (e.g. "Red, Black") and
   press **Make rows**. One row is made for each size/colour. For a product with no sizes, use the single row and
   leave **Variant** blank.
5. Fill each row: **Price / unit** and **MRP / unit** (GST included), **Unit barcode**, and if it has packs,
   **Pack price**, **Pack MRP** and **Pack barcode**; also **Rack** and **Min stock**. The arrow next to a column
   name copies the first row to all rows. **Add row** adds one more.
6. Save. The screen says **Item added** (or "N items added").

Good to know:
- New items can be billed straight away. Stock shows once they're counted (S1) or a purchase bill is entered (P1).
- If the product already exists, it offers **Add these as new variants of the existing product**.
- For many items at once, use Excel instead (I5).

### I2. Add an item while entering a distributor's bill
**Words people use:** purchase me naya item, maal me naya saman, bill me item nahi mila
**Who:** **Enter goods arrived** and **Add new items**.
On **Goods Arrived**, press **New item** next to the item search. Fill **Brand**, **Product name**, **Variant**,
**Sold in**, **HSN**, **GST %**, **Selling price** (GST included), **Barcode (single unit)**, and optionally
**Pack name**, units per pack and **Pack barcode**. Save; it's added to the purchase bill. (This box is only on
Goods Arrived. On New Bill, an item that isn't found must first be added with Add New Item.)

### I3. Change an item (price, rack, min stock, other names, switch it off)
**Words people use:** rate badalna, rate badle, price badle, price change, daam badlo, rack badalna, item band karna, item edit
**Who:** **Add new items** or **Change prices and items**. Price and MRP need **Change prices and items**.
1. Open the item (G4) and press **Edit**.
2. Change **Variant**, **Rack**, **Min stock**, **Other names (aliases)** (comma separated, e.g. "kit-kat, fuse
   carrier"), **Sold in** (only until stock has moved), **Selling price** and **MRP**.
3. To stop selling it, tick **Inactive (no longer stocked — hidden from lists, history kept)**.
4. Press save.

**Product, HSN & GST** (on the item page) changes the product name, category, HSN and GST for all its variants.
Needs **Change prices and items**.

### I4. Add a pack size or barcode to an item
**Words people use:** box ka barcode, coil add karna, pack jodna
**Who:** **Add new items** or **Change prices and items** (pack prices need **Change prices and items**).
1. Open the item. In **Units & barcodes**, press **Add pack**.
2. Fill **Pack name**, how many base units are in one pack, **Barcode** (camera icon on a phone), **Pack MRP** and
   **Pack price**. Then save.

Removing a pack size needs **Change prices and items**.

### I5. Add many items from Excel
**Words people use:** excel se upload, bahut saare item ek saath, price list dalna, sheet upload
**Who:** **Upload from Excel**.
1. **More → Upload from Excel**. Choose **Items (catalogue)**.
2. Press **Download the Excel template** (or **Download a filled sample** to see an example). The second sheet
   explains every column.
3. Fill one row per item: category, brand, product, variant, HSN, GST %, unit, MRP, selling price, pack details,
   barcodes, rack. Optionally fill the green **Stock** columns with what's on the shelf.
4. Choose the filled file and press **Check the file**. Nothing is saved yet. A **Preview** shows how many rows
   are new, updates or errors.
5. Fix errors in Excel and check again, or tick **Skip the N rows with errors and save the rest**.
6. Press **Save N rows**.

Stock columns don't change stock directly. They go into a **stock check** for the owner to look over and save
(S1, step 5).

### I6. Update prices from a distributor's new price list
**Words people use:** naya rate list, rate badal gaye, price update excel
**Who:** **Change prices and items**.
1. **More → Update Prices** (or Upload from Excel → **Price update**).
2. Download the template, and fill the barcode (unit or pack) or item code plus the new MRP and selling price.
3. **Check the file**, look at the preview, then **Save N rows**.

### I7. Lists of items: running low, not counted, not sold any more
**Words people use:** kya khatam ho raha hai, order karna hai, low stock list
**Who:** everyone.
**More → All Items**. Choose **All**, **Running low** (at or below min stock), **Not checked yet**, **Check
again**, or **Not sold any more**. **More → Running Low** opens the running-low list directly. Home's **Needs
attention** box also shows these counts.

---

## 7. Stock

### S1. Check (count) stock, one rack at a time
**Words people use:** stock ginti, stock check, rack count, maal ginna, physical stock
**Who:** counting: **Count stock**. Saving to stock: **Fix stock**.
1. Home → **Check Stock** (or **More → Check Stock**).
2. Under **Start a stock check**, type what you're counting, e.g. "Rack A3" or "Wires", and press **Start
   counting**.
3. **Scan to count:** scan each piece or pack. **Every scan adds one** (a pack scan adds a whole pack).
4. **Items without a barcode:** type the rack (e.g. A3) to list everything kept there, and type how many you find.
5. **Counted so far** lists everything counted. Staff with only **Count stock** stop here; the owner checks and
   saves it.
6. To save (with **Fix stock**): press **Check & save to stock**. It shows **System said** and **Difference** for
   each item. Confirm with **Yes, save to stock**.

What happens: those items' stock is set to what was counted (allowing for anything bought or sold since), and
they're marked as counted. **Cancel this count** discards it without changing stock.

### S2. When to count
**Words people use:** kab ginti kare, roz kitna gine, counting plan

Count gradually, one rack or kind of item a day. Costly and fast-moving items first (fans, MCBs, wire coils),
small hardware last. Items not counted yet show **Not checked yet**, never a made-up number. After everything is
counted once, do small weekly checks.

### S3. Fix stock (broken, lost, used in shop, mistake)
**Words people use:** saman toot gaya, kho gaya, sample diya, dukaan me use hua, stock theek karna, damage, nuksan
**Who:** **Fix stock**.
1. **More → Fix Stock**, then choose the item under **Which item?** (scan or search). Or press **Fix stock** on the
   item's page.
2. Choose **Remove from stock** or **Add to stock**, the **Quantity** and **Unit**.
3. Choose the **Reason**: **Damaged / broken**, **Lost / missing**, **Given as sample**, **Used in shop**, **Entry
   mistake correction** or **Other**. Write a **Note** ("What happened?").
4. Save. It's listed under **Stock fixed so far**, and the change shows in the item's stock history.

### S4. See how much was lost (damaged, lost, samples)
**Words people use:** nuksan kitna hua, loss, damage ka hisaab, kitna toota, kitna kho gaya, घाटा, नुकसान
**Who:** **See costs and profit** (and **Fix stock** to open the screen).
1. **More → Fix Stock**.
2. The **Losses** box shows the total written off this month, in ₹, and below it the amount for each reason:
   **Damaged / broken**, **Lost / missing**, **Given as sample**, **Used in shop**, **Other**.
3. To see another month, pick it in the month box at the top right of **Losses**.

Good to know:
- Each write-off is valued at the item's average buying cost on the day it was written off (S3).
- Stock added back (e.g. a lost item found again) comes off the loss. **Entry mistake correction** isn't counted,
  because it fixes typing, not a real loss.
- Items from before the app with no purchase entered have no cost yet. They're listed as "had no cost yet" and
  aren't in the total.

---

## 8. Buying from distributors

### P1. Goods arrived: enter a distributor's bill
**Words people use:** maal aaya, purchase entry, kharid bill, supplier ka bill, स्टॉक आया
**Who:** **Enter goods arrived**.
1. Home → **Goods Arrived** (or **More → Goods Arrived**).
2. **Bill details:** choose the **Distributor** (or + to add one: name, phone, GSTIN), the **Bill number** and
   **Bill date** from the paper bill, and any **Notes**.
3. Add each item on the bill: scan or search it. For an item not in the app, press **New item** (I2).
4. For each line fill **Qty**, **Unit** (e.g. box or coil), **Rate (before GST)** as printed on the bill, **Disc
   %** and **GST %**.
5. Check **Totals**. Type the bill's total in **Total printed on paper bill**: it says **Matches the paper bill**
   or by how much it differs. Fix the round-off if needed.
6. Not finished? Press **Save, finish later**. Stock doesn't change until it's added to stock. After the first
   save you can attach a **Photo / PDF of bill**.
7. When everything matches, press **Add to stock…**, read the check, and confirm with **Yes, add to stock**.

What happens: stock goes up, and each item's average cost is updated from this bill (GST excluded). The screen
says **Goods added to stock**. After this the bill can't be changed.

Good to know:
- Lines with no rate are added as free goods (₹0); the app warns before adding.
- A draft (not yet added to stock) can be removed with **Delete this bill**.
- Find bills later in **More → Purchase Bills**.

### P2. Distributors
**Words people use:** supplier add, distributor jodna, company ka naam, wholesaler
**Who:** **Enter goods arrived**.
**More → Distributors**: add or edit names, phone numbers and GSTIN. Also from the + next to **Distributor** on
Goods Arrived.

---

## 9. Money on Home

### M1. Today's figures
**Words people use:** aaj ki bikri, aaj kitna bika, galla, cash kitna hai, aaj ka hisaab, आज की बिक्री
**Who:** **See today's sales and cash**.
Home's **Today** box: **Sales** (and number of bills), **Cash in drawer** (cash taken minus cash given back),
**Given on udhaar**, **Udhaar paid back**, and **Goods returned** if any. **Today's bills** opens the list.

Others on Home:
- **Recent bills:** needs **See old bills**.
- **Udhaar to collect:** needs **See khata**.
- **Needs attention:** items running low, stock checks not finished, items not checked yet.

---

## 10. Owner only

### O1. Add a staff member and choose what they can do
**Words people use:** naya staff, employee add, login banana, permission dena
**Who:** owner.
1. **More → Staff & Access**, press **Add staff**.
2. Fill **Name**, **Username** (what they type to log in) and **Password** (at least 8 characters).
3. Under **What can they do?** tick the switches. Or **Start from:** **Counter** or **Store**, then adjust.
4. Save. They can log in at once.

To change someone's switches later, open their row in Staff & Access and tick or untick. Changes save and apply
straight away. Each row shows when they last logged in.

### O2. Reset a staff password / switch a login off
**Words people use:** password reset, naya password, staff hatana, kaam chhod diya, login band karna
**Who:** owner.
- **New password:** open the person in **Staff & Access**, press **New password** (at least 8 characters; not only
  numbers, not a common word) and tell them.
- **Someone leaves the job:** open them and press **Switch login off**. It works immediately, even if they're
  logged in. **Switch login on** brings it back. History stays.
- **Owner's own password:** in the **Back office** (More → **Back office (advanced)**), use "Change password" at
  the top.

### O3. Shop details printed on bills (GSTIN, address, bank, UPI)
**Words people use:** dukaan ki jankari, shop ka naam, GST number dalna, bank details, UPI ID, bill pe address
**Who:** owner.
1. **More → Shop Details** (opens the back office).
2. Fill **Name**, **GSTIN**, state code (Bihar is 10), **Address**, **Phone**, **Email**, bank name, branch,
   account number and IFSC, **UPI ID** (bills with udhaar then show a UPI QR code), invoice prefix (e.g. HE),
   **Round off bills** (to the nearest rupee), and **Invoice terms** (printed at the bottom of every bill, one
   per line).
3. Save.

If the GSTIN is missing, the bill print screen warns: *"Shop GSTIN is not set — fill in Shop settings in the back
office."*

### O4. Back office
**Words people use:** admin, back office, settings
**Who:** owner only.
**More → Back office (advanced)** opens the full records screen: shop settings, users, and every record.
Daily work is all in the app; use the back office for settings. It has its own limit on wrong passwords.

---

## 11. Printing

| What | How |
|---|---|
| **Bill** (A4 tax invoice) | Opens by itself after **Save & Print Bill**. Reprint: Old Bills → open → **Print**. |
| **Estimate** | Opens after **Make estimate**. Reprint from Estimates → open → **Print**. |
| **Credit note** (return) | Opens after saving a return. Also linked on the bill under Returns. |
| **Receipt** (udhaar payment) | **Print receipt** after taking a payment, or the receipt number in the khata. |
| **Khata statement** | Customer → **Print khata** (K7). |

Print on A4. In the print window, choose the shop's printer.

---

## 12. Messages you may see, and what to do

| Message | What it means / what to do |
|---|---|
| "To give udhaar, choose who is buying" | Pick a customer in **Who is buying?** (B2). |
| "₹… is unpaid. Choose a customer to put it on khata, or take full payment." | Payments are less than the bill and no customer is chosen. |
| "Payments (₹…) are more than the bill … give change." | In Part payment, enter the bill amount, not the note given. |
| "… would owe ₹…, over their credit limit … Ask the owner." | Over the customer's limit. Needs **Udhaar control**. |
| "… the price is too low. Ask the owner." | Below cost. Needs **Allow low prices**. |
| "… has no selling price. Type the rate." | Type the price on the line; ask the owner to set it on the item. |
| "For a bill over ₹50,000 to a walk-in buyer, enter their name and address" | Fill buyer details (B7). |
| "More than the stock shows — check the shelf" | Only a warning; the bill can be saved (B6). |
| "Goods from this bill were already returned, so it can't be cancelled." | Return the rest instead (B13). |
| "“Credit to khata” needs a bill made out to a customer." | Give the money back as cash or UPI. |
| "This customer already has an opening balance. Use an adjustment…" | Use **Correct the khata** (K6). |
| "No item has the code …" | That barcode isn't on any item. Add it (I1/I4) or type the name. |
| "Already used by …" | That barcode belongs to another item; check before saving. |
| "The camera isn't allowed for this site…" | Allow the camera in the browser's site settings, then try again. |
| "You were logged out after a long time away." | Log in again (G1). |
| "Too many tries. Wait a minute, then try again." | Too many attempts in a short time (often wrong passwords). Wait a minute. |
| A button or screen is missing | You don't have that switch. Ask the owner (§2). |

---

## 13. Daily rules for staff

- Nothing goes on the shelf without a purchase entry (**Goods Arrived**).
- Nothing leaves the shop without a bill (**New Bill**).
- Use your own login. Never share it.
- A wrong bill is cancelled or returned with a reason (B13, B14), never ignored.
