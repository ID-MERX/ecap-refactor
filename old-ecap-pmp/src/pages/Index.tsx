import LoginCard from "@/components/LoginCard";
import VersionFooter from "@/components/VersionFooter";
import AuroraBackground from "@/components/aceternity/AuroraBackground";
import RightImageSlider from "@/components/RightImageSlider";

const Index = () => {
  return (
    <AuroraBackground>
      <main className="relative z-10 min-h-screen">
        <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-12 lg:px-16 bg-gradient-to-br from-white via-emerald-50/30 to-sky-50/20">
            {/* Aurora background blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-32 -left-16 h-[24rem] w-[24rem] rounded-full bg-emerald-300/30 blur-[120px] animate-pulse [animation-duration:8s]" />
              <div className="absolute -bottom-24 -right-12 h-[26rem] w-[26rem] rounded-full bg-sky-300/25 blur-[120px] animate-pulse [animation-duration:10s] [animation-delay:-3s]" />
            </div>
            <div className="relative z-10 w-full flex justify-center">
              <LoginCard />
            </div>
          </section>
          <aside className="relative hidden lg:block min-h-0">
            <RightImageSlider
              images={[
                { src: "/pic-1.jpg", alt: "Program fieldwork photo" },

                { src: "/pic-3.jpg", alt: "Community program photo" },
                { src: "/pic-4.jpg", alt: "children getting medicine" }
              ]}
            />
            <div className="absolute bottom-10 left-10 right-10 text-white">
              <p className="text-xs font-semibold tracking-[0.4em] text-white/70">
                ECAP+ platform
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Track progress across communities with confidence.
              </h2>
              <p className="mt-2 text-sm text-white/80">
                Secure reporting, real-time insights, and streamlined monitoring in one place.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <VersionFooter />
    </AuroraBackground>
  );
};

export default Index;
