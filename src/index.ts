import ts, {
  isVariableDeclaration,
  SyntaxKind,
  visitEachChild,
} from 'typescript'

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

export function softMerge(fileName: string, a: string, b: string) {
  if (a == b) return b
  const A = ts.createSourceFile(fileName, a, ts.ScriptTarget.Latest)
  const B = ts.createSourceFile(fileName, b, ts.ScriptTarget.Latest)
  const R = ts.transform(A, [softMergeTransformer(B, '2')]).transformed[0]
  return printer.printFile(R)
}

function createFlag(name: string) {
  return ts.factory.createCallExpression(
    ts.factory.createIdentifier('__if'),
    undefined,
    [ts.factory.createStringLiteral(name)],
  )
}

const EXPRESSION = [ts.SyntaxKind.StringLiteral, ts.SyntaxKind.BinaryExpression]
const STATEMENT = [
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.ThrowStatement,
]

function isExpression(n: ts.Node): n is ts.Expression {
  return EXPRESSION.includes(n.kind)
}
function isStatement(n: ts.Node): n is ts.Statement {
  return STATEMENT.includes(n.kind)
}

class MergeError extends Error {
  constructor(
    public readonly a: ts.Node | undefined,
    public readonly b: ts.Node | undefined,
    A: ts.SourceFile,
    B: ts.SourceFile,
  ) {
    super(
      `Cannot merge ${
        a && printer.printNode(ts.EmitHint.Unspecified, a, A)
      } and ${b && printer.printNode(ts.EmitHint.Unspecified, b, B)}`,
    )
  }
}

const softMergeTransformer = (B: ts.SourceFile, flagName: string) => (
  context: ts.TransformationContext,
) => (A: ts.SourceFile): ts.SourceFile => {
  const f = createFlag(flagName)

  function visit(a: ts.Node, b: ts.Node): ts.Node | undefined {
    //console.log(SyntaxKind[a.kind], SyntaxKind[b.kind], a, b)
    if (eq(a, b)) return a
    if (isExpression(a) && isExpression(b)) return mergeExpression(a, b)
    if (isVariableDeclaration(a) && isVariableDeclaration(b)) {
      if (!eq(a.name, b.name)) throw new MergeError(a, b, A, B)
      if (!eq(a.exclamationToken, b.exclamationToken))
        throw new MergeError(a, b, A, B)
      if (!eq(a.type, b.type)) throw new MergeError(a, b, A, B)
      return ts.factory.createVariableDeclaration(
        a.name,
        a.exclamationToken,
        a.type,
        mergeExpression(a.initializer, b.initializer),
      )
    }
    if (a.kind == b.kind) {
      return mergeChildren(a, b, visit)
    }
    if (isStatement(a) && isStatement(b))
      return ts.factory.createIfStatement(f, b, a)
    throw new MergeError(a, b, A, B)
  }
  return merge(A, B, visit) as ts.SourceFile

  function mergeExpression(
    a: ts.Expression | undefined,
    b: ts.Expression | undefined,
  ) {
    if (!a && !b) return
    if (!a || !b) throw new MergeError(a, b, A, B)
    return ts.factory.createConditionalExpression(f, undefined, b, undefined, a)
  }

  function mergeChildren(
    a: ts.Node,
    b: ts.Node,
    visitor: (a: ts.Node, b: ts.Node) => ts.Node | undefined,
  ) {
    if (a.kind !== b.kind) throw new MergeError(a, b, A, B)
    const acs = [] as ts.Node[]
    ts.visitEachChild(a, (ac) => (acs.push(ac), ac), context)
    const bcs = [] as ts.Node[]
    ts.visitEachChild(b, (bc) => (bcs.push(bc), bc), context)
    if (acs.length == 0 || acs.length != bcs.length)
      throw new MergeError(a, b, A, B)
    let i = 0
    return ts.visitEachChild(a, (ac) => visitor(ac, bcs[i++]), context)
  }

  function eq(a: ts.Node | undefined, b: ts.Node | undefined) {
    if (!a && !b) return true
    if (!a || !b) throw new MergeError(a, b, A, B)
    return (
      a.kind === b.kind &&
      printer.printNode(ts.EmitHint.Unspecified, a, A) ==
        printer.printNode(ts.EmitHint.Unspecified, b, B)
    )
  }

  function merge(
    a: ts.Node,
    b: ts.Node,
    visitor: (a: ts.Node, b: ts.Node) => ts.Node | undefined,
  ) {
    return visitor(a, b)
  }
}
