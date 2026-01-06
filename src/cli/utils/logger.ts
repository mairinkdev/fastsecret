export const logger = {
  info:  (message: string) => console.log(`ℹ️  ${message}`),
  success: (message: string) => console.log(`✅ ${message}`),
  warn: (message: string) => console.log(`⚠️  ${message}`),
  error: (message: string) => console.error(`❌ ${message}`),
  debug: (message: string) => {
    if (process.env. DEBUG) {
      console.log(`🔍 ${message}`);
    }
  },
};