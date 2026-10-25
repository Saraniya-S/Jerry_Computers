export type ServiceId = "laptop" | "desktop" | "cctv" | "printer" | "ups" | "diagnostics";

export type Service = {
  id: ServiceId;
  slug: string;
  index: string;
  label: string;
  title: string;
  description: string;
  includes: string[];
};

export const services: Service[] = [
  {
    id: "laptop",
    slug: "laptop-repair",
    index: "01",
    label: "Laptops",
    title: "Laptop Repair and Maintenance",
    description: "Screens, keyboards, batteries, charging faults, upgrades and routine cleaning.",
    includes: ["Screen and keyboard replacement", "Battery and charging faults", "RAM and SSD upgrades", "Cleaning and thermal care"],
  },
  {
    id: "desktop",
    slug: "desktop-custom-pc",
    index: "02",
    label: "Desktops",
    title: "Desktop and Custom PC Services",
    description: "Custom builds to your brief, component upgrades and desktop troubleshooting.",
    includes: ["Custom PC builds", "Component upgrades", "OS installation", "Desktop troubleshooting"],
  },
  {
    id: "cctv",
    slug: "cctv-installation",
    index: "03",
    label: "CCTV",
    title: "CCTV Installation and Maintenance",
    description: "Camera planning, installation, recorder setup and ongoing maintenance.",
    includes: ["Site camera planning", "Camera and recorder installation", "Remote viewing setup", "Maintenance visits"],
  },
  {
    id: "printer",
    slug: "printer-repair",
    index: "04",
    label: "Printers",
    title: "Printer Repair and Support",
    description: "Paper jams, print-quality issues, network setup and regular servicing.",
    includes: ["Fault diagnosis", "Print-quality issues", "Network and driver setup", "Routine servicing"],
  },
  {
    id: "ups",
    slug: "ups-maintenance",
    index: "05",
    label: "UPS",
    title: "UPS Installation and Maintenance",
    description: "Sizing, installation, battery checks and replacement for backup power.",
    includes: ["Load sizing", "Installation", "Battery health checks", "Battery replacement"],
  },
  {
    id: "diagnostics",
    slug: "diagnostics-support",
    index: "06",
    label: "Support",
    title: "Hardware Diagnostics and Technical Support",
    description: "Find the fault first, then fix it — software, hardware and network issues.",
    includes: ["Hardware diagnostics", "Software and OS issues", "Virus and malware removal", "Network troubleshooting"],
  },
];

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
