const path = require("path")

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  devServer: {
    static: [
      { directory: path.join(__dirname, "dist") },
      { directory: path.join(__dirname, "src/assets"), publicPath: "/assets" },
    ],
    compress: true,
    port: 9000,
  },
  mode: "development",
}
