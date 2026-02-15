import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function Footer() {
    return (
        <footer className="bg-slate-950 text-slate-300 py-16">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center space-x-2 mb-4">
                            <div className="size-8 rounded-lg bg-white flex items-center justify-center">
                                <span className="text-slate-950 font-bold">F</span>
                            </div>
                            <span className="font-bold text-lg text-white">Field Service Pro</span>
                        </Link>
                        <p className="text-sm text-slate-400">
                            The all-in-one platform for modern field service businesses.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Product</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                            <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                            <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Company</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="#" className="hover:text-white transition-colors">About</Link></li>
                            <li><Link href="#" className="hover:text-white transition-colors">Careers</Link></li>
                            <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Get Started</h4>
                        <p className="text-sm text-slate-400 mb-4">
                            Ready to streamline your operations?
                        </p>
                        <Link href="/login">
                            <Button className="w-full bg-white text-slate-950 hover:bg-slate-100">
                                Start Free Trial
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-slate-500">
                    <p>&copy; {new Date().getFullYear()} Field Service Pro. All rights reserved.</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <Link href="#" className="hover:text-slate-300">Privacy</Link>
                        <Link href="#" className="hover:text-slate-300">Terms</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
