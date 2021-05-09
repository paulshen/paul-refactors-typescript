const refactorName = "Extract function type literal properties";
const refactorDescription = "Extract function type literal properties";

const extractFunctionTypeLiteralAction = {
  name: refactorName,
  description: refactorDescription,
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

      if (sourceFile === undefined) {
        return refactors;
      }

      // TODO
      if (true) {
        refactors.push({
          name: refactorName,
          description: refactorDescription,
          actions: [extractFunctionTypeLiteralAction],
        });
      }

      return refactors;
    };

    proxy.getEditsForRefactor = (
      fileName,
      formatOptions,
      positionOrRange,
      refactorName,
      actionName,
      preferences
    ) => {
      if (actionName === refactorName) {
        // TODO
      }
      return info.languageService.getEditsForRefactor(
        fileName,
        formatOptions,
        positionOrRange,
        refactorName,
        actionName,
        preferences
      );
    };

    return proxy;
  }

  return { create };
}

export = init;
