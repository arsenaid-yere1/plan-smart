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

interface PasswordResetEmailProps {
  resetUrl: string;
  email: string;
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  resetUrl,
  email,
}) => (
  <Html>
    <Head />
    <Preview>Reset your Plan Smart password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerText}>Reset Your Password</Heading>
        </Section>
        <Section style={content}>
          <Text style={paragraph}>Hi there,</Text>
          <Text style={paragraph}>
            We received a request to reset your password for your Plan Smart
            account associated with {email}.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>
          <Section style={warning}>
            <Text style={warningText}>
              <strong>Security Notice:</strong>
              <br />
              This password reset link will expire in 1 hour and can only be
              used once.
            </Text>
          </Section>
          <Text style={smallText}>
            If you didn&apos;t request a password reset, please ignore this
            email. Your password will remain unchanged.
          </Text>
          <Text style={smallText}>
            Or copy and paste this URL into your browser:
          </Text>
          <Link href={resetUrl} style={link}>
            {resetUrl}
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

const warning = {
  padding: '15px',
  backgroundColor: '#FEF2F2',
  borderLeft: '4px solid #EF4444',
  margin: '20px 0',
};

const warningText = {
  color: '#991B1B',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
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

export default PasswordResetEmail;
