import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2B2DFF] via-white to-[#A259FF] dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 font-sans">
      {/* Header */}
      <header className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              className="dark:invert"
              src="/next.svg"
              alt="Next.js logo"
              width={120}
              height={25}
              priority
            />
            <span className="text-xl font-extrabold tracking-tight text-gray-800 dark:text-gray-200" style={{letterSpacing: '0.01em'}}>Sandbox</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://debugg.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2 text-base font-semibold text-gray-700 dark:text-gray-300 hover:text-[#2B2DFF] dark:hover:text-[#A259FF] transition-colors rounded-full border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800"
            >
              About Debugg.ai
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-20">
            <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-[#2B2DFF] via-[#A259FF] to-[#FF61E6] bg-clip-text text-transparent mb-8 leading-tight">
              Debug Smarter, <span className="inline-block">Ship Faster.</span>
            </h1>
            <p className="text-2xl text-gray-700 dark:text-gray-300 mb-10 max-w-3xl mx-auto font-medium">
              Your AI-powered debugging companion. Discover intelligent error analysis, automated fixes, and seamless development workflows.
            </p>
            {/* Primary CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center mb-14">
              <a
                href="https://debugg.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-10 py-5 bg-gradient-to-r from-[#2B2DFF] to-[#A259FF] text-white font-bold rounded-full shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200 text-lg"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                Get Started
              </a>
              <a
                href="https://debugg.ai/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-10 py-5 border-2 border-[#2B2DFF] text-[#2B2DFF] dark:border-[#A259FF] dark:text-[#A259FF] font-bold rounded-full hover:bg-[#f5f7ff] dark:hover:bg-gray-900 transition-all duration-200 text-lg"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0H3" /></svg>
                Documentation
              </a>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-10 mb-20">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl hover:shadow-3xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-br from-[#2B2DFF] to-[#A259FF] rounded-2xl flex items-center justify-center mb-5 mx-auto">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h4" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 17H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Smart Error Analysis</h3>
              <p className="text-gray-600 dark:text-gray-400">AI-powered error detection and intelligent debugging suggestions.</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl hover:shadow-3xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-br from-[#A259FF] to-[#FF61E6] rounded-2xl flex items-center justify-center mb-5 mx-auto">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Automated Fixes</h3>
              <p className="text-gray-600 dark:text-gray-400">One-click solutions for common coding issues and bugs.</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl hover:shadow-3xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-br from-[#2B2DFF] to-[#FF61E6] rounded-2xl flex items-center justify-center mb-5 mx-auto">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 21a7.5 7.5 0 0113 0" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Team Collaboration</h3>
              <p className="text-gray-600 dark:text-gray-400">Share debugging insights and collaborate with your team seamlessly.</p>
            </div>
          </div>

          {/* Quick Actions */}
          <section className="bg-[#f5f7ff] dark:bg-gray-900 rounded-3xl shadow-xl p-10">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-8">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <a
                href="https://debugg.ai/try"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-7 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-base"
              >
                Try Demo
              </a>
              <a
                href="https://debugg.ai/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-7 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-base"
              >
                View Pricing
              </a>
              <a
                href="https://debugg.ai/support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-7 py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-base"
              >
                Get Support
              </a>
              <a
                href="https://debugg.ai/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-7 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-base"
              >
                Read Blog
              </a>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-10 mt-20">
        <div className="border-t border-gray-200 dark:border-gray-700 pt-10">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-6 mb-4 md:mb-0">
              <a
                className="flex items-center gap-2 hover:underline hover:underline-offset-4 text-gray-600 dark:text-gray-400"
                href="https://nextjs.org/learn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  aria-hidden
                  src="/file.svg"
                  alt="File icon"
                  width={18}
                  height={18}
                />
                Learn Next.js
              </a>
              <a
                className="flex items-center gap-2 hover:underline hover:underline-offset-4 text-gray-600 dark:text-gray-400"
                href="https://vercel.com/templates"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  aria-hidden
                  src="/window.svg"
                  alt="Window icon"
                  width={18}
                  height={18}
                />
                Templates
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-500 dark:text-gray-400 text-base">
                Powered by Next.js & Debugg.ai
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
