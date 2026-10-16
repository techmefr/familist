import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

// Android scanning uses the WebView camera and ZXing in both flavours.
// F-Droid also excludes Firebase; notifications there use ntfy or the background listener.
const NON_FREE_PLUGINS = ['@capacitor-mlkit/barcode-scanning', '@capacitor/push-notifications'];

// Open-source (MIT) plugins that do not start with `@capacitor` yet belong in the F-Droid build.
const EXTRA_FREE_PLUGINS = ['@capawesome-team/capacitor-android-foreground-service'];

const isFdroid = process.env.FAMILIST_FLAVOR === 'fdroid';

function androidPlugins(): string[] {
	const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as {
		dependencies: Record<string, string>;
	};

	const free = Object.keys(dependencies).filter(
		(name) =>
			(name.startsWith('@capacitor') || name.startsWith('@capgo/capacitor-')) &&
			name !== '@capacitor-mlkit/barcode-scanning' &&
			(!isFdroid || !NON_FREE_PLUGINS.includes(name)) &&
			!['@capacitor/core', '@capacitor/android', '@capacitor/ios'].includes(name)
	);

	return [...free, ...EXTRA_FREE_PLUGINS.filter((name) => name in dependencies)];
}

const config: CapacitorConfig = {
	appId: 'fr.techmefr.familist',
	appName: 'Familiste',
	webDir: 'build',
	android: {
		adjustMarginsForEdgeToEdge: 'auto',
		flavor: isFdroid ? 'fdroid' : 'play',
		includePlugins: androidPlugins()
	},
	plugins: {
		LocalNotifications: {
			smallIcon: 'ic_stat_familiste'
		},
		SplashScreen: {
			launchAutoHide: false,
			backgroundColor: '#F1EDE5'
		}
	}
};

export default config;
