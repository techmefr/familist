import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

// Both ship Google libraries (ML Kit, Firebase Messaging): F-Droid refuses them. Push there goes through
// ntfy or the background listener instead.
const NON_FREE_PLUGINS = ['@capacitor-mlkit/barcode-scanning', '@capacitor/push-notifications'];

// Open-source (MIT) plugins that do not start with `@capacitor` yet belong in the F-Droid build.
const EXTRA_FREE_PLUGINS = ['@capawesome-team/capacitor-android-foreground-service'];

const isFdroid = process.env.FAMILIST_FLAVOR === 'fdroid';

function freePlugins(): string[] {
	const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as {
		dependencies: Record<string, string>;
	};

	const free = Object.keys(dependencies).filter(
		(name) =>
			name.startsWith('@capacitor') &&
			!NON_FREE_PLUGINS.includes(name) &&
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
		...(isFdroid ? { includePlugins: freePlugins() } : {})
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
