import { Navbar } from "@/components/navigation/Navbar";
import { HeroSection } from "@/components/home/HeroSection";
import { AboutSection } from "@/components/home/AboutSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { WhyChooseUsSection } from "@/components/home/WhyChooseUsSection";
import { ProductsSection } from "@/components/home/ProductsSection";
import { ContactSection } from "@/components/home/ContactSection";
import { HomeFooter } from "@/components/home/HomeFooter";
import { getServices } from "@/lib/server/services";
import { getSettings } from "@/lib/server/settings";

export default async function Home() {
  const [services, home] = await Promise.all([getServices(), getSettings("home")]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-fg focus:px-4 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <HeroSection />
        <AboutSection />
        <ServicesSection services={services} />
        <WhyChooseUsSection copy={home.reasons} />
        <ProductsSection />
        <ContactSection />
      </main>
      <HomeFooter />
    </>
  );
}
