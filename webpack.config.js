const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const pug = require("pug");
const YamlRecursiveLoader = require("./yamlRecursiveLoader");

module.exports = function (env, argv) {
  console.log("env", env);

  const PAGES_DIR = path.join(".", "src", "pages");
  const TRANSLATIONS_DIR = path.join(".", "src", "translations");
  const PAGES = fs
    .readdirSync(PAGES_DIR)
    .filter(
      (fileName) => fileName.endsWith(".pug") && !fileName.endsWith("index.pug")
    );
  const translations = fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter(
      (fileName) => fileName.endsWith(".yaml") || fileName.endsWith(".yml")
    );
  const translatedPages = translations.reduce((acc, translationFile) => {
    const pageName = translationFile.replace(/\.[a-z]{2}\.ya?ml/, ".pug");
    if (!acc[pageName]) {
      acc[pageName] = [];
    }
    acc[pageName].push({
      html: translationFile.replace(/\.ya?ml/, ".html"),
      translationFile,
    });
    return acc;
  }, {});
  PAGES.forEach((fileName) => {
    if (!translatedPages[fileName]) {
      translatedPages[fileName] = [
        {
          html: fileName.replace(/\.pug/, ".html"),
        },
      ];
    }
  });
  console.log("translatedPages", translatedPages);

  return {
    target: "web",
    entry: {
      main: `./src/index.js`,
    },
    resolve: {
      extensions: [".js"],
    },
    output: {
      path: path.join(__dirname, "/dist"),
      publicPath: "",
      scriptType: "text/javascript",
    },
    watchOptions: {
      aggregateTimeout: 200,
      ignored: /node_modules/,
      poll: 500,
    },
    devServer: {
      contentBase: "./dist",
      port: 8082,
      overlay: {
        warnings: true,
        errors: true,
      },
    },
    module: {
      noParse: /\.min\.js/,
      rules: [
        {
          test: /\.pug$/,
          loader: "pug-loader",
        },
        {
          test: /\.(eot|woff2?|ttf|svg)$/,
          loader: "file-loader",
          options: {
            outputPath: "fonts/",
          },
        },
        {
          test: /\.s?[ca]ss$/i,
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader?url=true",
            "postcss-loader",
            "sass-loader",
          ],
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin(),
      new HtmlWebpackPlugin({
        filename: "index.html",
        inject: false,
        minify: false,
        collapseWhitespace: false,
        templateContent: () => {
          return pug.renderFile(path.join(".", "src", "index.pug"), {
            pages: Object.keys(translatedPages).reduce(
              (acc, key) => [...acc, ...translatedPages[key]],
              []
            ),
          });
        },
      }),
      ...PAGES.map((page) => {
        const res = [];
        for (let pageData of translatedPages[page]) {
          res.push(
            new HtmlWebpackPlugin({
              filename: "./" + pageData.html,
              inject: false,
              minify: false,
              collapseWhitespace: false,
              templateContent: async (context) => {
                console.log(
                  "context.htmlWebpackPlugin.files",
                  context.htmlWebpackPlugin.files
                );
                const rl = new YamlRecursiveLoader();
                return rl
                  .loadYaml(
                    pageData.translationFile,
                    path.join(__dirname, "src", "translations")
                  )
                  .then((translation) => {
                    return pug.renderFile(
                      path.join(".", "src", "pages", page),
                      {
                        translation,
                        styles: context.htmlWebpackPlugin.files.css,
                      }
                    );
                  })
                  .catch((e) => {
                    return e.message;
                  });
              },
            })
          );
        }
        return res;
      }).reduce((acc, arr) => [...acc, ...arr], []),
    ],
  };
};
