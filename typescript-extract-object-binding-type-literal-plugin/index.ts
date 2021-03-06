const refactorName = "Extract object binding type literal properties";
const refactorDescription = "Extract object binding type literal properties";

const extractFunctionTypeLiteralAction = {
  name: refactorName,
  description: refactorDescription,
  kind: "refactor.extract.object-type-literal",
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

    function getTypeLiteralNodeAndObjectBindingPattern(
      sourceFile: ts.SourceFile | undefined,
      positionOrRange: number | ts.TextRange
    ): [ts.ObjectBindingPattern, ts.TypeLiteralNode] | undefined {
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
          // @ts-ignore
          node.name !== undefined &&
          // @ts-ignore
          node.type !== undefined &&
          // @ts-ignore
          ts.isObjectBindingPattern(node.name) &&
          // @ts-ignore
          ts.isTypeLiteralNode(node.type)
        ) {
          // @ts-ignore
          return [node.name, node.type];
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
      const nodes = getTypeLiteralNodeAndObjectBindingPattern(
        sourceFile,
        positionOrRange
      );
      if (nodes !== undefined) {
        refactors.push({
          name: refactorName,
          description: refactorDescription,
          actions: [extractFunctionTypeLiteralAction],
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
      const nodes = getTypeLiteralNodeAndObjectBindingPattern(
        sourceFile,
        positionOrRange
      );
      if (nodes === undefined) {
        return;
      }
      const [objectBindingNode, typeLiteralNode] = nodes;
      const nodeFactory = ts.factory;
      const bindingElements = [];
      for (let i = 0; i < typeLiteralNode.members.length; i++) {
        const member = typeLiteralNode.members[i];
        if (member.name === undefined || !ts.isIdentifier(member.name)) {
          return;
        }
        bindingElements.push(
          nodeFactory.createBindingElement(
            undefined,
            undefined,
            member.name.getText()
          )
        );
      }
      const newObjectBindingPattern =
        nodeFactory.createObjectBindingPattern(bindingElements);
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
            objectBindingNode,
            newObjectBindingPattern,
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
