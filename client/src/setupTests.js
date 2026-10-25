import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// react-router v7 needs these; CRA's jsdom doesn't provide them
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
