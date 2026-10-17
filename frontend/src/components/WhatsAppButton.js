import { MessageCircle } from "lucide-react";
import { whatsappLink } from "../lib/whatsapp.js";
import { Button } from "../ui/index.js";

/** Opens WhatsApp with the message typed and addressed (plan §12); the person presses Send there. */
export default function WhatsAppButton({ phone, text, label = "WhatsApp", className = "" }) {
  return (
    <Button href={whatsappLink(phone, text)} className={className} title="Opens WhatsApp with the message ready; press Send there">
      <MessageCircle size={18} className="text-green-700" /> {label}
    </Button>
  );
}
