import { getServices } from "@/lib/server/services";
import { NavbarClient } from "./NavbarClient";

/** Site header with live services in its menu. The service list is cached, so this stays static. */
export async function Navbar() {
  return <NavbarClient services={await getServices()} />;
}
