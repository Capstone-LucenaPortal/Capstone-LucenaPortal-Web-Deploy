import { redirect } from "next/navigation";

export default function HomePage() {
  // /super-staff is inside the request guard's matcher, so an anonymous
  // visitor is already bounced to /super-staff/login before this runs. Anyone
  // who gets here has a session and belongs on the accounts pool. Sending them
  // to login instead would only add a hop: that page turns a signed-in visitor
  // straight back around.
  redirect("/super-staff/accounts");
}
