import { useEffect, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, TrendingUp } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // Auto-play entrance animation on load
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Image card entrance
      tl.fromTo(
        imageRef.current,
        { opacity: 0, scale: 1.06, y: 40 },
        { opacity: 1, scale: 1, y: 0, duration: 0.7 },
        0
      );

      // Headline words entrance
      const words = headlineRef.current?.querySelectorAll('.word');
      if (words) {
        tl.fromTo(
          words,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.03 },
          0.25
        );
      }

      // Subheadline + CTAs
      tl.fromTo(
        [subheadRef.current, ctaRef.current],
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
        0.55
      );

      // Stats card
      tl.fromTo(
        statsRef.current,
        { opacity: 0, x: '10vw' },
        { opacity: 1, x: 0, duration: 0.5 },
        0.75
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Scroll-driven exit animation
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
          onLeaveBack: () => {
            // Reset all elements to visible when scrolling back to top
            gsap.set([imageRef.current, headlineRef.current, subheadRef.current, ctaRef.current, statsRef.current], {
              opacity: 1,
              x: 0,
              y: 0,
              scale: 1,
            });
          },
        },
      });

      // Phase 1 (0-30%): Hold - elements already visible from load animation
      // Phase 2 (30-70%): Settle - stable viewing
      // Phase 3 (70-100%): Exit

      // Headline block exit
      scrollTl.fromTo(
        headlineRef.current,
        { x: 0, opacity: 1 },
        { x: '-18vw', opacity: 0, ease: 'power2.in' },
        0.70
      );

      // Subheadline exit
      scrollTl.fromTo(
        subheadRef.current,
        { x: 0, opacity: 1 },
        { x: '-14vw', opacity: 0, ease: 'power2.in' },
        0.72
      );

      // Hero image card exit
      scrollTl.fromTo(
        imageRef.current,
        { x: 0, scale: 1, opacity: 1 },
        { x: '-10vw', scale: 0.98, opacity: 0.6, ease: 'power2.in' },
        0.70
      );

      // Stats card exit
      scrollTl.fromTo(
        statsRef.current,
        { x: 0, opacity: 1 },
        { x: '10vw', opacity: 0, ease: 'power2.in' },
        0.72
      );

      // CTA row exit
      scrollTl.fromTo(
        ctaRef.current,
        { y: 0, opacity: 1 },
        { y: '10vh', opacity: 0, ease: 'power2.in' },
        0.74
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      ref={sectionRef}
      className="section-pinned bg-[#F4F2EE] z-10"
    >
      {/* Hero Image Card */}
      <div
        ref={imageRef}
        className="absolute left-[6vw] top-[14vh] w-[62vw] h-[72vh] rounded-[34px] overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.10)]"
      >
        <img
          src="/hero_electrician.jpg"
          alt="Professional electrician at work"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Headline Block */}
      <div
        ref={headlineRef}
        className="absolute left-[52vw] top-[26vh] w-[42vw] z-10"
      >
        <h1 className="text-[clamp(2.5rem,5vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.02em] text-[#111111]">
          <span className="word inline-block">We </span>
          <span className="word inline-block">buy </span>
          <span className="word inline-block">and </span>
          <span className="word inline-block">build </span>
          <span className="word inline-block">electrical </span>
          <span className="word inline-block">service </span>
          <span className="word inline-block">companies.</span>
        </h1>
      </div>

      {/* Subheadline */}
      <p
        ref={subheadRef}
        className="absolute left-[52vw] top-[52vh] w-[34vw] text-lg text-[#6E6E6E] leading-relaxed"
      >
        Metro Electrical Capital partners with owners in the Greater NYC area to 
        preserve legacies, protect teams, and grow cash-flowing trades businesses.
      </p>

      {/* CTA Row */}
      <div
        ref={ctaRef}
        className="absolute left-[52vw] top-[66vh] flex items-center gap-6"
      >
        <button
          onClick={() => scrollToSection('contact')}
          className="btn-primary flex items-center gap-2"
        >
          Request a Conversation
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => scrollToSection('target-criteria')}
          className="btn-secondary"
        >
          View Our Criteria
        </button>
      </div>

      {/* Stats Card */}
      <div
        ref={statsRef}
        className="absolute left-[72vw] top-[74vh] w-[22vw] h-[18vh] bg-white rounded-[28px] shadow-[0_18px_60px_rgba(0,0,0,0.10)] p-6 flex flex-col justify-center"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#2F6BFF]/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#2F6BFF]" />
          </div>
          <span className="text-2xl font-bold text-[#111111]">$40M+</span>
        </div>
        <p className="text-sm text-[#6E6E6E] leading-snug">
          acquisition capacity
          <br />
          <span className="text-xs">Flexible deal structures. Fast, respectful process.</span>
        </p>
      </div>
    </section>
  );
};

export default Hero;
