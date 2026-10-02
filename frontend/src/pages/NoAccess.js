import { Lock } from "lucide-react";
import { Card, GoHomeButton } from "../ui/index.js";

/** Opened a screen this person isn't allowed to use (an old link, a typed address). */
export default function NoAccess() {
  return (
    <div className="max-w-xl mx-auto md:py-6">
      <Card className="p-6 md:p-9 flex flex-col items-center text-center gap-2">
        <span className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-gray-100 text-gray-600">
          <Lock size={34} />
        </span>
        <h1 className="text-3xl font-bold leading-tight mt-2">You don't have access to this</h1>
        <p className="text-gray-600">Ask the owner to switch it on for you.</p>
        <div className="w-full max-w-sm flex flex-col gap-3 mt-5">
          <GoHomeButton />
        </div>
      </Card>
    </div>
  );
}
