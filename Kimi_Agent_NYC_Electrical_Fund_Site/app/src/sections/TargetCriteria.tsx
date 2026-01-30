import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Zap, DollarSign, TrendingUp, Award, Users, MapPin } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const criteria = [
  { icon: Zap, title: 'Electrical services focus' },
  { icon: DollarSign, title: 'Revenue $2M–$15M' },
  { icon: TrendingUp, title: 'Profitable with stable cash flow' },
  { icon: Award, title: 'Strong local reputation' },
  { icon: Users, title: 'Experienced field teams' },
  { icon: MapPin, title: 'Greater NYC / Tri-State' },
];

const TargetCriteria = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const headlineCardRef = useRef<HTMLDivElement>(null);
  const criteriaCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.5,
        },
      });

      // Phase 1 - ENTRANCE (0% - 30%)
      scrollTl.fromTo(
        imageRef.current,
        { x: '-60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        headlineCardRef.current,
        { x: '60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.05
      );

      criteriaCardsRef.current.forEach((card, i) => {
        if (card) {
          scrollTl.fromTo(
            card,
            { y: '40vh', scale: 0.92, opacity: 0 },
            { y: 0, scale: 1, opacity: 1, ease: 'none' },
            0.14 + i * 0.025
          );
        }
      });

      // Phase 3 - EXIT (70% - 100%)
      scrollTl.fromTo(
        headlineCardRef.current,
        { y: 0, opacity: 1 },
        { y: '-16vh', opacity: 0, ease: 'power2.in' },
        0.70
      );

      scrollTl.fromTo(
        imageRef.current,
        { y: 0, opacity: 1 },
        { y: '10vh', opacity: 0.6, ease: 'power2.in' },
        0.70
      );

      criteriaCardsRef.current.forEach((card, i) => {
        if (card) {
          scrollTl.fromTo(
            card,
            { x: 0, opacity: 1 },
            { x: '14vw', opacity: 0, ease: 'power2.in' },
            0.72 + i * 0.015
          );
        }
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="target-criteria"
      className="section-pinned bg-[#F4F2EE] z-30"
    >
      {/* Left Image Card */}
      <div
        ref={imageRef}
        className="absolute left-[6vw] top-[14vh] w-[30vw] h-[72vh] rounded-[34px] overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.10)]"
      >
        <img
          src="/target_team.jpg"
          alt="Electrical team with service van"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Headline Card (Dark) */}
      <div
        ref={headlineCardRef}
        className="absolute left-[38vw] top-[14vh] w-[56vw] h-[22vh] bg-[#111111] rounded-[34px] p-10 flex flex-col justify-center"
      >
        <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-bold text-[#F4F2EE] leading-[1.05] tracking-[-0.02em]">
          What we look for.
        </h2>
        <p className="mt-3 text-[#6E6E6E] text-lg">
          If your business fits this profile, we should talk.
        </p>
      </div>

      {/* Criteria Grid */}
      <div className="absolute left-[38vw] top-[40vh] w-[56vw] h-[46vh] grid grid-cols-3 grid-rows-2 gap-[1.2vw]">
        {criteria.map((item, i) => (
          <div
            key={item.title}
            ref={(el) => { criteriaCardsRef.current[i] = el; }}
            className="bg-white rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-6 flex flex-col justify-center items-center text-center"
          >
            <div className="w-12 h-12 bg-[#2F6BFF]/10 rounded-xl flex items-center justify-center mb-4">
              <item.icon className="w-6 h-6 text-[#2F6BFF]" />
            </div>
            <h3 className="text-sm font-semibold text-[#111111] leading-snug">
              {item.title}
            </h3>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TargetCriteria;
