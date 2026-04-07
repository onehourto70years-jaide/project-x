import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Only trigger haptics on native devices (not web)
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — buttons, toggles, list item press */
export function hapticLight() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap — important actions, confirmations */
export function hapticMedium() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy tap — destructive or significant actions */
export function hapticHeavy() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Success — achievement unlocked, task completed, goal reached */
export function hapticSuccess() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning — delete confirmation, approaching limit */
export function hapticWarning() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error — failed action, validation error */
export function hapticError() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Selection — tab switch, picker change, scroll snap */
export function hapticSelection() {
  if (isNative) Haptics.selectionAsync();
}
