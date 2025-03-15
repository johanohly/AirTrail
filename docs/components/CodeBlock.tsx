import { highlight } from 'fumadocs-core/server';
import * as Base from 'fumadocs-ui/components/codeblock';

export interface CodeBlockProps {
  code: string;
  wrapper?: Base.CodeBlockProps;
  lang: string;
}

export async function CodeBlock({
  code,
  lang,
  wrapper,
}: Readonly<CodeBlockProps>): Promise<React.ReactElement> {
  const rendered = await highlight(code, {
    lang,
    components: {
      pre: Base.Pre,
    },
  });

  return <Base.CodeBlock {...wrapper}>{rendered}</Base.CodeBlock>;
}
