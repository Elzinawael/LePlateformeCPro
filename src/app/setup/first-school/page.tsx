import { redirect } from "next/navigation";

export default function RetiredBootstrapPage():never {
  redirect("/login?notice=setup-retired");
}
