import { Navigation } from "@/_v0preview/components/landing/navigation";
import { HeroSection } from "@/_v0preview/components/landing/hero-section";
import { ProofStrip } from "@/_v0preview/components/sections/proof-strip";
import { Convictions } from "@/_v0preview/components/sections/convictions";
import { FeaturesSection } from "@/_v0preview/components/landing/features-section";
import { HowItWorksSection } from "@/_v0preview/components/landing/how-it-works-section";
import { InfrastructureSection } from "@/_v0preview/components/landing/infrastructure-section";
import { MetricsSection } from "@/_v0preview/components/landing/metrics-section";
import { IntegrationsSection } from "@/_v0preview/components/landing/integrations-section";
import { SecuritySection } from "@/_v0preview/components/landing/security-section";
import { DevelopersSection } from "@/_v0preview/components/landing/developers-section";
import { TestimonialsSection } from "@/_v0preview/components/landing/testimonials-section";
import { PricingSection } from "@/_v0preview/components/landing/pricing-section";
import { CtaSection } from "@/_v0preview/components/landing/cta-section";
import { FooterSection } from "@/_v0preview/components/landing/footer-section";

// ponytail: throwaway preview route to compare the v0 (Optimus rebrand) design
// against the live nebuloz route. Delete once direction (blend vs substitute) is chosen.
export default function V0Preview() {
  return (
    <div className="dark bg-background text-foreground min-h-screen">
      <Navigation />
      <HeroSection />
      <ProofStrip />
      <main className="relative overflow-x-hidden">
        <Convictions />
        <FeaturesSection />
        <HowItWorksSection />
        <InfrastructureSection />
        <MetricsSection />
        <IntegrationsSection />
        <SecuritySection />
        <DevelopersSection />
        <TestimonialsSection />
        <PricingSection />
        <CtaSection />
      </main>
      <FooterSection />
    </div>
  );
}
