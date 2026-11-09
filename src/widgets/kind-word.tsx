/** Home screen widgets are iOS-only for now (see kind-word.ios.tsx). */
export type KindWordProps = { from: string; text: string };

export function updateKindWordWidget(_props: KindWordProps) {
  // no-op on Android and web
}
