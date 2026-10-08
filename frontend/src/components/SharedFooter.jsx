import React from 'react';
import { Link } from 'react-router-dom';

const SharedFooter = () => {
    return (
        <footer className="bg-[#111827] text-white py-12 px-6">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-2xl font-black mb-2">SHADOWMEN</h3>
                    <p className="text-sm text-gray-400">Professional Peoples, At Your Doorstep</p>
                </div>
                <div className="flex gap-6 text-sm text-gray-300">
                    <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
                </div>
            </div>
            <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
                &copy; {new Date().getFullYear()} SHADOWMEN. All rights reserved.
            </div>
        </footer>
    );
};

export default SharedFooter;
