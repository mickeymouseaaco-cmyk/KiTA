/**
 * iOS home screen widget: the latest kind word from your partner.
 * Rendered by expo-widgets with SwiftUI components (marked with 'widget').
 */
import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type KindWordProps = { from: string; text: string };

const KindWord = createWidget<KindWordProps>(
  'KindWord',
  (props) => {
    'widget';
    return (
      <VStack alignment="leading" spacing={6} modifiers={[padding()]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#6A4C9C')]}>{`From ${props.from}`}</Text>
        <Text modifiers={[font({ size: 16, design: 'serif' })]}>{props.text}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#625C6E')]}>Together</Text>
      </VStack>
    );
  },
  { from: 'Together', text: 'A kind word from your partner will appear here.' },
);

/** Show the newest kind word on the home screen. */
export function updateKindWordWidget(props: KindWordProps) {
  try {
    KindWord.updateSnapshot({ from: props.from, text: props.text.slice(0, 140) });
  } catch {
    // widget extension not installed in this build
  }
}
