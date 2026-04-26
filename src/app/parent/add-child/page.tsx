import { redirect } from "next/navigation";

export default function ParentAddChildRedirectPage() {
  redirect("/parent?addChild=1");
}
