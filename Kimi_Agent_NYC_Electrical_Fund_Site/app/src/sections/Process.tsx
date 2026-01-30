import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileText, Building2, FileCheck, Handshake } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    icon: FileText,
    number: '01',
    title: 'Intro & Review',
    description: 'We sign an NDA, review financials, and ask the right questions.',
  },
  {
    icon: Building2,
    number: '02',
    title: 'Site Visit',
    description: 'We meet the team, observe operations, and build trust.',
  },
  {
    icon: FileCheck,
    number: '03',
    title: 'Offer & Terms',
    description: 'A straightforward LOI with flexible structure.',
  },
  {
    icon: Handshake,
    number: '04',
    title: 'Close & Transition',
    description: 'We close efficiently and plan the handoff together.',
  },
];

const Process = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Heading animation
      gsap.fromTo(
        headingRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: 0.6,
          },
        }
      );

      // Spine line animation
      gsap.fromTo(
        spineRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 60%',
            end: 'bottom 40%',
            scrub: 0.6,
          },
        }
      );

      // Card animations (staggered)
      cardRefs.current.forEach((card, i) => {
        if (card) {
          const fromX = i % 2 === 0 ? '-10vw' : '10vw';
          gsap.fromTo(
            card,
            { x: fromX, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                end: 'top 55%',
                scrub: 0.6,
              },
            }
          );
        }
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#F4F2EE] py-[12vh] z-50"
    >
      {/* Heading */}
      <div ref={headingRef} className="px-[6vw] mb-16">
        <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#111111] leading-[1.05] tracking-[-0.02em] max-w-[52vw]">
          How it works.
        </h2>
        <p className="mt-4 text-[#6E6E6E] text-lg max-w-[40vw]">
          A clear, respectful process—designed around your business.
        </p>
      </div>

      {/* Timeline Container */}
      <div className="relative px-[6vw]">
        {/* Spine Line */}
        <div
          ref={spineRef}
          className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#2F6BFF]/20 origin-top"
          style={{ transform: 'translateX(-50%)' }}
        />

        {/* Cards */}
        <div className="space-y-8">
          {steps.map((step, i) => (
            <div
              key={step.number}
              ref={(el) => { cardRefs.current[i] = el; }}
              className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`w-[42vw] bg-white rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-8 flex gap-6 ${
                  i % 2 === 0 ? 'ml-0' : 'mr-0'
                }`}
              >
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-[#2F6BFF]/10 rounded-xl flex items-center justify-center">
                    <step.icon className="w-7 h-7 text-[#2F6BFF]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs text-[#2F6BFF] uppercase tracking-wider">
                      Step {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-[#111111] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[#6E6E6E] text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Process;
