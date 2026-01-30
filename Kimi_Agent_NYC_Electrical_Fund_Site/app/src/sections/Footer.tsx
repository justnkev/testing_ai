import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Linkedin, Mail } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Footer = () => {
  const footerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        footer,
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: footer,
            start: 'top 90%',
            end: 'top 70%',
            scrub: 0.6,
          },
        }
      );
    }, footer);

    return () => ctx.revert();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer
      ref={footerRef}
      className="bg-[#F4F2EE] py-[8vh] px-[6vw] z-[90]"
    >
      <div className="flex flex-col lg:flex-row justify-between gap-12">
        {/* Left - Logo & Tagline */}
        <div className="lg:max-w-sm">
          <h3 className="text-xl font-bold text-[#111111] mb-3">
            Metro Electrical Capital
          </h3>
          <p className="text-[#6E6E6E] text-sm leading-relaxed mb-6">
            We buy and build electrical service companies in the Greater NYC area. 
            Preserving legacies. Protecting teams. Growing businesses.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="mailto:hello@metroelectrical.capital"
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center 
                       shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]
                       transition-all hover:-translate-y-0.5"
              aria-label="Email"
            >
              <Mail className="w-5 h-5 text-[#111111]" />
            </a>
            <a
              href="#"
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center 
                       shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]
                       transition-all hover:-translate-y-0.5"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5 text-[#111111]" />
            </a>
          </div>
        </div>

        {/* Right - Link Columns */}
        <div className="flex flex-wrap gap-12 lg:gap-20">
          {/* For Sellers */}
          <div>
            <h4 className="font-semibold text-[#111111] mb-4 text-sm uppercase tracking-wider">
              For Sellers
            </h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => scrollToSection('target-criteria')}
                  className="text-[#6E6E6E] text-sm hover:text-[#2F6BFF] transition-colors"
                >
                  Our Criteria
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('for-sellers')}
                  className="text-[#6E6E6E] text-sm hover:text-[#2F6BFF] transition-colors"
                >
                  Why Sell?
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="text-[#6E6E6E] text-sm hover:text-[#2F6BFF] transition-colors"
                >
                  Get a Valuation
                </button>
              </li>
            </ul>
          </div>

          {/* For Investors */}
          <div>
            <h4 className="font-semibold text-[#111111] mb-4 text-sm uppercase tracking-wider">
              For Investors
            </h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => scrollToSection('for-investors')}
                  className="text-[#6E6E6E] text-sm hover:text-[#2F6BFF] transition-colors"
                >
                  Investment Thesis
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('what-we-do')}
                  className="text-[#6E6E6E] text-sm hover:text-[#2F6BFF] transition-colors"
                >
                  Our Approach
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="text-[#6E6E6E] text-sm hover:text-[#2F6BFF] transition-colors"
                >
                  Partner With Us
                </button>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-[#111111] mb-4 text-sm uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="text-[#6E6E6E] text-sm hover:text-[#2F6BFF] transition-colors"
                >
                  Contact
                </button>
              </li>
              <li>
                <span className="text-[#6E6E6E] text-sm cursor-not-allowed">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="text-[#6E6E6E] text-sm cursor-not-allowed">
                  Terms of Use
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="mt-12 pt-8 border-t border-[#E5E5E5] flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-[#6E6E6E] text-xs">
          © 2026 Metro Electrical Capital. All rights reserved.
        </p>
        <p className="text-[#6E6E6E] text-xs">
          Greater NYC Area · +1 (203) 321-5028
        </p>
      </div>
    </footer>
  );
};

export default Footer;
