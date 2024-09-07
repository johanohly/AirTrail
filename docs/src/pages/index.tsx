import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { useColorMode } from '@docusaurus/theme-common';

function HomepageHeader() {
  const { isDarkTheme } = useColorMode();
  return (
    <header>
      <section className="text-center m-6 p-12 border border-red-400 rounded-[50px] bg-slate-200 dark:bg-dark-2">
        <img
          src={
            isDarkTheme ? 'img/airtrail-logo-dark.png' : 'img/airtrail-logo.png'
          }
          className="md:h-60 h-44 mb-2 antialiased rounded-none"
          alt="AirTrail logo"
        />
        <div className="sm:text-2xl text-lg md:text-4xl mb-12 sm:leading-tight">
          <p className="mb-1 font-medium text-primary">
            A modern, open-source <div className="block" />
            personal flight tracking system
          </p>
        </div>
        <div className="flex flex-col sm:flex-row place-items-center place-content-center mt-9 mb-16 gap-4 ">
          <Link
            className="flex place-items-center place-content-center py-3 px-8 border bg-primary rounded-full no-underline hover:no-underline text-white hover:text-gray-50 font-bold uppercase"
            to="docs/overview/introduction"
          >
            Get started
          </Link>

          <Link
            className="flex place-items-center place-content-center py-3 px-8 border rounded-full hover:no-underline text-primary font-bold uppercase"
            to="https://github.com/JohanOhly/AirTrail"
          >
            GitHub
          </Link>
        </div>
        <img
          src={isDarkTheme ? 'img/dark.png' : 'img/light.png'}
          alt="AirTrail preview"
          width={'70%'}
        />
      </section>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline} noFooter={true}>
      <HomepageHeader />
      <div className="flex flex-col place-items-center place-content-center">
        <p>{siteConfig.themeConfig.footer.copyright}</p>
      </div>
    </Layout>
  );
}
