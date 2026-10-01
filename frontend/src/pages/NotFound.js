import { SearchX } from "lucide-react";
import { Button, Card, GoHomeButton } from "../ui/index.js";

/** A page address that doesn't exist (typed wrong, or an old bookmark). */
export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto md:py-6">
      <Card className="p-6 md:p-9 flex flex-col items-center text-center gap-2">
        <span className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-gray-100 text-gray-600">
          <SearchX size={36} />
        </span>
        <h1 className="text-3xl font-bold leading-tight mt-2">Page not found</h1>
        <p className="text-gray-600">This page doesn't exist. The address may be typed wrong, or the page has moved.</p>
        <div className="w-full max-w-sm flex flex-col gap-3 mt-5">
          <GoHomeButton />
          <Button to="/more" className="h-14 text-lg">
            See all options
          </Button>
        </div>
      </Card>
    </div>
  );
}
