import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { SUPPORT_EMAIL } from '../client';

interface VerificationEmailProps {
  verificationUrl: string;
  email?: string;
}

export const VerificationEmail: React.FC<VerificationEmailProps> = ({
  verificationUrl,
}) => (
  <Html>
    <Head />
    <Preview>Verify your Plan Smart account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerText}>Welcome to Plan Smart!</Heading>
        </Section>
        <Section style={content}>
          <Text style={paragraph}>Hi there,</Text>
          <Text style={paragraph}>
            Thanks for signing up for Plan Smart! To complete your registration,
            please verify your email address by clicking the button below:
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Verify Email Address
            </Button>
          </Section>
          <Text style={smallText}>
            If you didn&apos;t create an account with Plan Smart, you can safely
            ignore this email.
          </Text>
          <Text style={smallText}>
            This verification link will expire in 24 hours.
          </Text>
          <Text style={smallText}>
            Or copy and paste this URL into your browser:
          </Text>
          <Link href={verificationUrl} style={link}>
            {verificationUrl}
          </Link>
        </Section>
        <Section style={footer}>
          <Text style={footerText}>
            Plan Smart - Your Retirement Planning Partner
          </Text>
          <Text style={footerText}>
            Questions? Contact us at {SUPPORT_EMAIL}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: 'Arial, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
};

const header = {
  backgroundColor: '#4F46E5',
  padding: '20px',
  textAlign: 'center' as const,
};

const headerText = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
};

const content = {
  backgroundColor: '#ffffff',
  padding: '30px 20px',
};

const paragraph = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#4F46E5',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
};

const link = {
  color: '#4F46E5',
  fontSize: '14px',
  wordBreak: 'break-all' as const,
};

const footer = {
  padding: '20px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '4px 0',
};

export default VerificationEmail;
