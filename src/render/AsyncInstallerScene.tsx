import { lazy, Suspense, type ComponentProps } from 'react';

const Scene = lazy(() => import('./InstallerScene'));

export default function AsyncInstallerScene(props: ComponentProps<typeof Scene>) {
 return <Suspense fallback={null}><Scene {...props}/></Suspense>;
}
