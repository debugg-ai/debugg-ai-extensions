import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">Sandbox</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://debugg.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              About Debugg.ai
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
              Welcome to Debugg.ai
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              Your AI-powered debugging companion. Discover intelligent error analysis, 
              automated fixes, and seamless development workflows.
            </p>
            
            {/* Primary CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a
                href="https://debugg.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
                Get Started with Debugg.ai
              </a>
              <a
                href="https://debugg.ai/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Documentation
              </a>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Smart Error Analysis</h3>
              <p className="text-gray-600 dark:text-gray-400">AI-powered error detection and intelligent debugging suggestions.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Automated Fixes</h3>
              <p className="text-gray-600 dark:text-gray-400">One-click solutions for common coding issues and bugs.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-pink-600 dark:text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Team Collaboration</h3>
              <p className="text-gray-600 dark:text-gray-400">Share debugging insights and collaborate with your team seamlessly.</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a
                href="https://debugg.ai/try"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
              >
                Try Demo
              </a>
              <a
                href="https://debugg.ai/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
              >
                View Pricing
              </a>
              <a
                href="https://debugg.ai/support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
              >
                Get Support
              </a>
              <a
                href="https://debugg.ai/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
              >
                Read Blog
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 mt-16">
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
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
                  width={16}
                  height={16}
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
                  width={16}
                  height={16}
                />
                Templates
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                Powered by Next.js & Debugg.ai
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
