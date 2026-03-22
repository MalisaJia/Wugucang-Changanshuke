/** @type {import('next').NextConfig} */
const nextConfig = {};

const withNextIntl = require("next-intl/plugin")("./src/lib/i18n/request.ts");

module.exports = withNextIntl(nextConfig);
