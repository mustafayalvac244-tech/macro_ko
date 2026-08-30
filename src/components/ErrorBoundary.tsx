import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide safety net. Without this, any error thrown while rendering a screen
 * unmounts the whole tree and the user sees a blank white screen. Here we catch
 * it, show a friendly recoverable card, and surface the message so the problem
 * is reportable instead of invisible.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep a breadcrumb in the JS console / crash logs.
    console.error('Uncaught UI error:', error);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private goHome = () => {
    this.reset();
    try {
      router.replace('/(app)');
    } catch {
      // navigation may not be ready; resetting state already re-renders children
    }
  };

  private goBack = () => {
    this.reset();
    try {
      if (router.canGoBack()) router.back();
      else router.replace('/(app)');
    } catch {
      // ignore
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={44} color="#B97E14" />
        </View>
        <Text style={styles.title}>Bir şeyler ters gitti</Text>
        <Text style={styles.desc}>
          Bu ekranda beklenmeyen bir sorun oluştu. Verileriniz güvende — geri dönüp tekrar deneyebilirsiniz.
        </Text>

        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.primary]} onPress={this.goBack}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Geri Dön</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={this.goHome}>
            <Ionicons name="home-outline" size={18} color="#1E63E9" />
            <Text style={styles.secondaryText}>Ana Sayfa</Text>
          </Pressable>
        </View>

        <Text style={styles.errLabel}>Teknik ayrıntı (destek için):</Text>
        <Text style={styles.errText} selectable numberOfLines={4}>
          {this.state.error.message || String(this.state.error)}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#F4F6FA',
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: 'rgba(185,126,20,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F1F3D',
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    color: '#5A6B85',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primary: {
    backgroundColor: '#1E63E9',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6DEEC',
  },
  secondaryText: {
    color: '#1E63E9',
    fontWeight: '700',
    fontSize: 15,
  },
  errLabel: {
    fontSize: 11,
    color: '#8A97AC',
    marginTop: 32,
    fontWeight: '700',
  },
  errText: {
    fontSize: 12,
    color: '#8A97AC',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
