import React, { useEffect } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import SharedFooter from '../components/SharedFooter';

const PrivacyPolicyPage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#FFFBEB] text-[#111827] overflow-x-hidden font-sans flex flex-col">
            <SharedNavbar />
            
            <main className="flex-grow pt-32 pb-24 px-6">
                <div className="max-w-4xl mx-auto bg-white border border-[#FEF3C7] rounded-3xl p-8 md:p-12 shadow-sm">
                    <h1 className="text-4xl md:text-5xl font-black text-[#111827] mb-8">Privacy Policy</h1>
                    <p className="text-sm text-gray-500 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-gray-700 leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">1. Introduction</h2>
                            <p>
                                Welcome to SHADOWMEN ("we", "our", or "us"). We respect your privacy and are committed to protecting it through our compliance with this policy. This Privacy Policy describes how we collect, use, and protect your information when you use the SHADOWMEN service marketplace app and website (https://www.shadowmen.in).
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">2. Information We Collect</h2>
                            <p className="mb-2">We collect information depending on whether you are a Customer, Worker, or Company:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Account & Profile Information:</strong> We collect your name, mobile number, email, and profile information when you register for an account.</li>
                                <li><strong>Service Bookings & Addresses:</strong> We collect location information and service addresses to facilitate service bookings and live tracking.</li>
                                <li><strong>Identity & KYC Documents:</strong> For Workers and Companies, we collect KYC and identity documents for verification purposes. <br/> <em>Note: Identity/KYC documents of the platform owner, workers, or users are handled privately and disclosed only where legally required.</em></li>
                                <li><strong>Communications & Reviews:</strong> We collect information about customer-worker communications and any reviews or ratings you provide.</li>
                                <li><strong>Device & App Information:</strong> We collect technical logs, device information, and push notification tokens to improve our platform.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">3. How We Use Your Information</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>To provide and maintain the SHADOWMEN marketplace and your account.</li>
                                <li>To match customers with suitable workers based on location and service requests.</li>
                                <li>To process payments securely through our payment provider (e.g., Razorpay) in escrow.</li>
                                <li>To verify the identity of workers and ensure customer safety.</li>
                                <li>To send notifications regarding bookings, payments, and system updates.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">4. Data Storage and Security</h2>
                            <p>
                                We implement appropriate technical and organizational measures designed to secure your personal information from accidental loss and from unauthorized access, use, alteration, and disclosure. Your data is stored on secure servers.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">5. Third-Party Service Providers</h2>
                            <p>
                                We may share your information with third-party service providers (such as payment processors like Razorpay) solely for the purpose of facilitating our services. We do not sell your personal data to third parties.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">6. Legal Disclosures</h2>
                            <p>
                                We may disclose your personal information and identity/KYC documents only when legally required to do so by law enforcement or regulatory authorities.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">7. Data Retention and Deletion</h2>
                            <p>
                                We retain your information for as long as your account is active or as needed to provide you services. You have the right to request the deletion of your account and personal data by contacting our support team.
                            </p>
                        </section>
                        
                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">8. Children's Privacy</h2>
                            <p>
                                Our platform is not intended for individuals under 18 years of age. We do not knowingly collect personal data from children.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">9. Changes to Our Privacy Policy</h2>
                            <p>
                                We may update our Privacy Policy from time to time. If we make material changes, we will notify you through the platform or via email. Your continued use of the platform after updates constitutes acceptance of the changes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-[#111827] mb-4">10. Contact Information</h2>
                            <p>
                                For questions or concerns about this Privacy Policy or our data practices, please contact the owner/publisher:
                            </p>
                            <div className="mt-4 p-4 bg-[#FFFBEB] rounded-xl border border-[#FEF3C7]">
                                <p><strong>Phone:</strong> 7428151031</p>
                                <p><strong>Website:</strong> <a href="https://www.shadowmen.in" className="text-[#F97316] hover:underline">https://www.shadowmen.in</a></p>
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            <SharedFooter />
        </div>
    );
};

export default PrivacyPolicyPage;
