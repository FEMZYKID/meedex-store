'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------
// EDIT ME: your real support contact details.
// SUPPORT_WHATSAPP must be digits only, country code first, no + or spaces
// (e.g. Nigeria number 0801 234 5678 becomes "2348012345678").
// ---------------------------------------------------------------------
const SUPPORT_PHONE = '+234 906 791 1723';
const SUPPORT_WHATSAPP = '2349067911723';
const SUPPORT_EMAIL = 'meedexgadgets1@gmail.com';

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-4 py-3 rounded-full shadow-lg flex items-center gap-2 text-sm transition"
      >
        💬 Need Help?
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl text-gray-900"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-800">Contact Us</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                &times;
              </button>
            </div>

            <div className="space-y-2">
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition text-sm font-semibold text-green-800"
              >
                🟢 Chat on WhatsApp
              </a>
              <a
                href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-800"
              >
                📞 Call {SUPPORT_PHONE}
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition text-sm font-semibold text-amber-800"
              >
                ✉️ Email {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}