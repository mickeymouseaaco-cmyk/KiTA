/**
 * Vent: a private place to let something out.
 * Text is never written anywhere. Voice is recorded to a temporary file on this
 * phone, never uploaded, and deleted when you let it go or leave this screen.
 */
import { File } from 'expo-file-system';
import { Feather, Lock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, TextInput, View } from 'react-native';

import { Button, Card, Gap, Row, Screen, Segmented, T, useInputStyle } from '@/components/ui';
import { VoicePlayer, VoiceRecorder, type Recording } from '@/components/voice';
import { haptic } from '@/lib/haptics';
import { LIMITS } from '@/lib/media';
import { space, useTheme } from '@/theme';

function forget(uri: string | null) {
  if (!uri) return;
  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    return;
  }
  try {
    new File(uri).delete();
  } catch {
    // already gone
  }
}

export default function Vent() {
  const { c } = useTheme();
  const input = useInputStyle();
  const [mode, setMode] = useState<'type' | 'talk'>('type');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<Recording | null>(null);
  const [released, setReleased] = useState(false);
  const [fade] = useState(() => new Animated.Value(1));
  const voiceRef = useRef<string | null>(null);
  useEffect(() => {
    voiceRef.current = voice?.uri ?? null;
  }, [voice]);

  // Leaving the screen always deletes any recording.
  useEffect(() => () => forget(voiceRef.current), []);

  function letGo() {
    haptic.soft();
    Animated.timing(fade, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setText('');
      forget(voice?.uri ?? null);
      setVoice(null);
      setReleased(true);
      fade.setValue(1);
    });
  }

  const hasSomething = mode === 'type' ? text.trim().length > 0 : !!voice;

  return (
    <Screen edges={['bottom']}>
      <Card tone="sage">
        <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
          <Lock color={c.onSage} size={20} style={{ marginTop: 2 }} />
          <T color={c.onSage} style={{ flex: 1 }}>
            Just for you. Nothing here is saved, uploaded, or shared, and it&apos;s gone when you close this screen.
          </T>
        </Row>
      </Card>
      <Gap />

      {released ? (
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <Feather color={c.primary} size={40} />
          <T variant="title" center testID="vent-released">
            Let it go.
          </T>
          <T muted center>
            Take a slow breath. You did something kind for yourself.
          </T>
          <Gap h={space.sm} />
          <Button label="Vent again" kind="soft" small onPress={() => setReleased(false)} />
        </View>
      ) : (
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'type', label: 'Type it out' },
              { value: 'talk', label: 'Say it out loud' },
            ]}
          />
          <Gap />
          <Animated.View style={{ opacity: fade }}>
            {mode === 'type' ? (
              <TextInput
                testID="vent-text"
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                placeholder="Whatever you need to say…"
                placeholderTextColor={c.textMuted}
                autoCorrect={false}
                style={[input, { minHeight: 220, textAlignVertical: 'top' }]}
              />
            ) : voice ? (
              <Card>
                <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
              </Card>
            ) : (
              <VoiceRecorder maxMs={LIMITS.voiceMaxMs} hint="Hold to talk" onDone={setVoice} />
            )}
          </Animated.View>
          <Gap h={space.xl} />
          <Button testID="vent-let-go" label="Let it go" icon={Feather} onPress={letGo} disabled={!hasSomething} />
        </>
      )}
    </Screen>
  );
}
