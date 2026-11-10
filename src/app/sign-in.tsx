import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { KitaLogo } from '@/components/logo';
import { Button, Field, Gap, Screen, Segmented, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { auth } from '@/lib/firebase';
import { createProfile } from '@/lib/session';
import { space, useTheme } from '@/theme';

export default function SignIn() {
  const { c, dark } = useTheme();
  const input = useInputStyle();
  const [mode, setMode] = useState<'new' | 'returning'>('new');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.includes('@') && password.length >= 6 && (mode === 'returning' || name.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'new') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await createProfile(cred.user.uid, name.trim());
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code.includes('email-already-in-use')) setError('There’s already an account with that email. Try "I have an account".');
      else if (code.includes('weak-password')) setError('Let’s pick a password with at least 6 characters.');
      else if (code.includes('network')) setError(gentleError.offline);
      else setError(gentleError.signIn);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <Gap h={space.xl} />
        <View style={{ alignItems: 'center', gap: space.md }}>
          <View accessibilityRole="header" accessibilityLabel="KiTA">
            <KitaLogo height={72} onDark={dark} />
          </View>
          <T muted center style={{ maxWidth: 320 }}>
            A gentle place to look after yourselves, and each other.
          </T>
        </View>
        <Gap h={space.xxl} />
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'new', label: 'I’m new' },
            { value: 'returning', label: 'I have an account' },
          ]}
        />
        <Gap h={space.xl} />
        <View style={{ gap: space.lg }}>
          {mode === 'new' ? (
            <Field label="Your first name" helper="This is what your partner will see.">
              <TextInput
                testID="name"
                value={name}
                onChangeText={setName}
                autoComplete="given-name"
                textContentType="givenName"
                placeholder="e.g. Sam"
                placeholderTextColor={c.textMuted}
                style={input}
                maxLength={60}
              />
            </Field>
          ) : null}
          <Field label="Email">
            <TextInput
              testID="email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholderTextColor={c.textMuted}
              style={input}
            />
          </Field>
          <Field label="Password" helper={mode === 'new' ? 'At least 6 characters.' : undefined}>
            <TextInput
              testID="password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
              textContentType={mode === 'new' ? 'newPassword' : 'password'}
              style={input}
              onSubmitEditing={() => canSubmit && submit()}
            />
          </Field>
          {error ? (
            <T accessibilityLiveRegion="polite" color={c.onButter} style={{ backgroundColor: c.butter, padding: space.md, borderRadius: 12 }}>
              {error}
            </T>
          ) : null}
          <Button testID="submit" label={mode === 'new' ? 'Create my space' : 'Welcome back'} onPress={submit} loading={busy} disabled={!canSubmit} hint={mode === 'new' ? 'Add your name, email and a password of 6 or more characters.' : 'Add your email and password.'} />
        </View>
        <Gap h={space.xl} />
        <T variant="small" muted center>
          Your logs are private by default. You choose, one by one, what your partner can see.
        </T>
      </Screen>
    </KeyboardAvoidingView>
  );
}
