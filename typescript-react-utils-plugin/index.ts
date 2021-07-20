const refactorName = "Convert JSX className string literal to expression";
const refactorDescription =
  "Convert JSX className string literal to expression";

const convertJsxStringLiteralAction = {
  name: refactorName,
  description: refactorDescription,
  kind: "refactor.typescript-react.jsx-classname-string-literal",
};

function init(modules: {
  typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
  const ts = modules.typescript;
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const proxy: ts.LanguageService = Object.create(null);
    for (let k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x = info.languageService[k];
      // @ts-ignore
      proxy[k] = (...args: Array<{}>) => x!.apply(info.languageService, args);
    }

    function getJsxAttributeClassnameStringLiteral(
      sourceFile: ts.SourceFile | undefined,
      positionOrRange: number | ts.TextRange
    ): ts.StringLiteral | undefined {
      if (sourceFile === undefined || sourceFile.isDeclarationFile) {
        return;
      }
      const position =
        typeof positionOrRange === "number"
          ? positionOrRange
          : positionOrRange.pos;
      let node = getNodeAtPosition(sourceFile, position);
      while (node !== undefined) {
        if (
          ts.isJsxAttribute(node) &&
          node.name.text === "className" &&
          node.initializer !== undefined &&
          ts.isStringLiteral(node.initializer)
        ) {
          return node.initializer;
        }

        node = node.parent;
      }
      return undefined;
    }

    proxy.getApplicableRefactors = function (
      fileName,
      positionOrRange,
      preferences,
      triggerReason,
      kind
    ): ts.ApplicableRefactorInfo[] {
      const refactors = info.languageService.getApplicableRefactors(
        fileName,
        positionOrRange,
        preferences,
        triggerReason,
        kind
      );

      const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName);
      if (
        getJsxAttributeClassnameStringLiteral(sourceFile, positionOrRange) !==
        undefined
      ) {
        refactors.push({
          name: refactorName,
          description: refactorDescription,
          actions: [convertJsxStringLiteralAction],
        });
      }

      return refactors;
    };

    function getEdits(
      fileName: string,
      positionOrRange: number | ts.TextRange,
      formatOptions: ts.FormatCodeSettings,
      preferences: ts.UserPreferences | undefined
    ) {
      const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName);
      const jsxAttributeClassnameStringLiteralNode =
        getJsxAttributeClassnameStringLiteral(sourceFile, positionOrRange);
      if (jsxAttributeClassnameStringLiteralNode === undefined) {
        return;
      }
      const nodeFactory = ts.factory;
      // @ts-ignore
      const edits = ts["textChanges"].ChangeTracker.with(
        {
          host: info.languageServiceHost,
          // @ts-ignore
          formatContext: ts["formatting"].getFormatContext(formatOptions),
          preferences: preferences,
        },
        // @ts-ignore
        (tracker) => {
          tracker.replaceNode(
            sourceFile,
            jsxAttributeClassnameStringLiteralNode,
            nodeFactory.createJsxExpression(
              undefined,
              nodeFactory.createCallExpression(
                nodeFactory.createIdentifier("classNames"),
                undefined,
                [jsxAttributeClassnameStringLiteralNode]
              )
            ),
            undefined
          );
        }
      );
      return edits;
    }

    proxy.getEditsForRefactor = (
      fileName,
      formatOptions,
      positionOrRange,
      refactorNameArgument,
      actionName,
      preferences
    ) => {
      if (actionName === refactorName) {
        const edits = getEdits(
          fileName,
          positionOrRange,
          formatOptions,
          preferences
        );
        if (edits !== undefined) {
          return { edits };
        }
      }
      return info.languageService.getEditsForRefactor(
        fileName,
        formatOptions,
        positionOrRange,
        refactorNameArgument,
        actionName,
        preferences
      );
    };

    return proxy;
  }

  function getNodeAtPosition(
    sourceFile: ts.SourceFile,
    position: number
  ): ts.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
      if (position >= node.getStart() && position < node.getEnd()) {
        return node.forEachChild(find) ?? node;
      }
    }

    return find(sourceFile);
  }

  return { create };
}

export = init;
