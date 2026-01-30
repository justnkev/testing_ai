import { useRef, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { toast } from 'sonner';

gsap.registerPlugin(ScrollTrigger);

const Contact = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
  });

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        textRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: textRef.current,
            start: 'top 80%',
            end: 'top 50%',
            scrub: 0.6,
          },
        }
      );

      gsap.fromTo(
        formRef.current,
        { x: '10vw', opacity: 0 },
        {
          x: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: formRef.current,
            start: 'top 75%',
            end: 'top 45%',
            scrub: 0.6,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Thank you for reaching out! We will get back to you within 48 hours.');
    setFormData({ name: '', email: '', phone: '', company: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative bg-[#111111] min-h-screen py-[12vh] z-[80]"
    >
      <div className="px-[6vw] flex flex-col lg:flex-row gap-12 lg:gap-0">
        {/* Left Text Block */}
        <div ref={textRef} className="lg:w-[40vw] lg:pr-12">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-bold text-[#F4F2EE] leading-[1.0] tracking-[-0.02em] mb-6">
            Let's talk.
          </h2>
          <p className="text-[#6E6E6E] text-lg leading-relaxed mb-10 max-w-md">
            If you're considering a sale—or you represent a business that fits—reach out. 
            We respond within 48 hours.
          </p>

          {/* Contact Details */}
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#2F6BFF]/20 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#2F6BFF]" />
              </div>
              <div>
                <p className="text-xs text-[#6E6E6E] uppercase tracking-wider mb-0.5">Email</p>
                <a 
                  href="mailto:hello@metroelectrical.capital" 
                  className="text-[#F4F2EE] hover:text-[#2F6BFF] transition-colors"
                >
                  hello@metroelectrical.capital
                </a>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#2F6BFF]/20 rounded-xl flex items-center justify-center">
                <Phone className="w-5 h-5 text-[#2F6BFF]" />
              </div>
              <div>
                <p className="text-xs text-[#6E6E6E] uppercase tracking-wider mb-0.5">Phone</p>
                <a 
                  href="tel:+12033215028" 
                  className="text-[#F4F2EE] hover:text-[#2F6BFF] transition-colors"
                >
                  +1 (203) 321-5028
                </a>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#2F6BFF]/20 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#2F6BFF]" />
              </div>
              <div>
                <p className="text-xs text-[#6E6E6E] uppercase tracking-wider mb-0.5">Location</p>
                <p className="text-[#F4F2EE]">Greater NYC Area</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Card */}
        <div
          ref={formRef}
          className="lg:absolute lg:right-[6vw] lg:top-[14vh] lg:w-[44vw] bg-[#F4F2EE] rounded-[36px] p-8 lg:p-10"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white rounded-xl border border-[#E5E5E5] text-[#111111] 
                           placeholder:text-[#6E6E6E] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30
                           transition-all"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white rounded-xl border border-[#E5E5E5] text-[#111111] 
                           placeholder:text-[#6E6E6E] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30
                           transition-all"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-[#E5E5E5] text-[#111111] 
                           placeholder:text-[#6E6E6E] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30
                           transition-all"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111111] mb-2">
                  Company
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-[#E5E5E5] text-[#111111] 
                           placeholder:text-[#6E6E6E] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30
                           transition-all"
                  placeholder="Company name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2">
                Message
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 bg-white rounded-xl border border-[#E5E5E5] text-[#111111] 
                         placeholder:text-[#6E6E6E] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30
                         transition-all resize-none"
                placeholder="Tell us about your business..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#2F6BFF] text-white py-4 rounded-xl font-semibold 
                       flex items-center justify-center gap-2
                       transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01]
                       active:translate-y-0 active:scale-[0.99]"
            >
              Send Message
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Contact;
