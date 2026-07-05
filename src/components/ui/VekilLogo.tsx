import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

const NAVY = '#1C3A5E';
const GOLD = '#C6A24A';

interface VekilLogoProps {
  size?: number;
  /** Fill color for the node ring centers — match the surface behind the logo. */
  nodeFill?: string;
}

/**
 * The Vekil "tech scales of justice" mark as a true vector — crisp at any
 * size (no pixelation). Reused on the login/splash and anywhere the brand
 * emblem is shown.
 */
export function VekilLogo({ size = 120, nodeFill = '#FFFFFF' }: VekilLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      {/* gold pan bowls */}
      <Path d="M110 300 A46 46 0 0 0 202 300 Z" fill={GOLD} />
      <Path d="M310 300 A46 46 0 0 0 402 300 Z" fill={GOLD} />

      <G fill="none" stroke={NAVY} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round">
        <Line x1="140" y1="150" x2="372" y2="150" />
        <Line x1="256" y1="168" x2="256" y2="402" />
        <Line x1="156" y1="156" x2="110" y2="300" />
        <Line x1="156" y1="156" x2="202" y2="300" />
        <Line x1="356" y1="156" x2="310" y2="300" />
        <Line x1="356" y1="156" x2="402" y2="300" />
        <Line x1="110" y1="300" x2="202" y2="300" />
        <Line x1="310" y1="300" x2="402" y2="300" />
        <Line x1="196" y1="436" x2="316" y2="436" />
        <Path d="M226 182 L226 206 L286 206 L286 182" />
      </G>

      <Path d="M238 402 L274 402 L292 436 L220 436 Z" fill={NAVY} />

      <Circle cx="256" cy="86" r="17" fill="none" stroke={NAVY} strokeWidth={13} />
      <Circle cx="256" cy="86" r="6" fill={GOLD} />
      <Circle cx="256" cy="150" r="18" fill={nodeFill} stroke={NAVY} strokeWidth={13} />
      <Circle cx="256" cy="150" r="6" fill={GOLD} />
      <Circle cx="140" cy="150" r="17" fill={nodeFill} stroke={NAVY} strokeWidth={13} />
      <Circle cx="140" cy="150" r="6" fill={GOLD} />
      <Circle cx="372" cy="150" r="17" fill={nodeFill} stroke={NAVY} strokeWidth={13} />
      <Circle cx="372" cy="150" r="6" fill={GOLD} />
      <Line x1="256" y1="103" x2="256" y2="132" stroke={NAVY} strokeWidth={13} strokeLinecap="round" />

      <Rect x="222" y="238" width="14" height="14" rx="2" fill={GOLD} />
      <Rect x="276" y="238" width="14" height="14" rx="2" fill={GOLD} />
    </Svg>
  );
}
