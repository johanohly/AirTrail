import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Jsx, toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { remark } from 'remark';
import remarkRehype from 'remark-rehype';
import { z } from 'zod';

export default async function Changelog() {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  });

  const resp = await fetch(
    'https://api.github.com/repos/johanohly/AirTrail/releases',
  );
  const body = await resp.json();
  const releases: {
    name: string;
    body: string;
    html_url: string;
    published_at: Date;
    bodyElement?: JSX.Element;
  }[] = z
    .object({
      name: z.string(),
      body: z.string(),
      html_url: z.string(),
      published_at: z.coerce.date(),
    })
    .array()
    .parse(body);

  const processor = remark().use(remarkRehype);
  const { img: _, ...comps } = defaultMdxComponents;

  for (const release of releases) {
    const nodes = processor.parse({
      value: release.body.replaceAll("What's Changed", ''),
    });
    const hast = await processor.run(nodes);
    release.bodyElement = toJsxRuntime(hast, {
      development: false,
      jsx: jsx as Jsx,
      jsxs: jsxs as Jsx,
      Fragment,
      // @ts-expect-error -- safe to use
      components: comps,
    });
  }

  return (
    <div className="flex flex-col">
      <div className="">
        <h3 className="text-3xl font-bold">Changelog</h3>
        <p className="text-muted-foreground">
          Stay up to date with the latest changes to AirTrail!
        </p>
      </div>
      <div className="border-t mt-10 pt-20" />
      {releases.map((release, i) => (
        <section
          className={`relative flex flex-col ${release.name !== releases[0].name && 'border-t pt-20 !mt-20'}`}
          key={i}
        >
          <p className="text-muted-foreground">
            {formatter.format(release.published_at)}
          </p>
          <h1 className="text-3xl font-bold !m-0">{release.name}</h1>
          <div className="prose">{release.bodyElement}</div>
        </section>
      ))}
    </div>
  );
}
