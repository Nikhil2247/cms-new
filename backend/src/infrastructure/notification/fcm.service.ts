import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor(private configService: ConfigService) {
    // Initialize Firebase Admin SDK
    const serviceAccount = this.configService.get('FIREBASE_SERVICE_ACCOUNT');

    if (serviceAccount && !admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
      });
    }
  }

  /**
   * Send push notification to a single device
   */
  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully: ${response}`);

      return response;
    } catch (error) {
      this.logger.error('Failed to send push notification', error.stack);
      throw error;
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: any,
  ): Promise<admin.messaging.BatchResponse> {
    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      this.logger.log(
        `Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`,
      );

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.error(
              `Failed to send to token ${tokens[idx]}: ${resp.error}`,
            );
          }
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to send push notifications', error.stack);
      throw error;
    }
  }

  /**
   * Subscribe a device to a topic
   */
  async subscribeToTopic(token: string, topic: string): Promise<void> {
    try {
      await admin.messaging().subscribeToTopic([token], topic);
      this.logger.log(`Token subscribed to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}`, error.stack);
      throw error;
    }
  }

  /**
   * Unsubscribe a device from a topic
   */
  async unsubscribeFromTopic(token: string, topic: string): Promise<void> {
    try {
      await admin.messaging().unsubscribeFromTopic([token], topic);
      this.logger.log(`Token unsubscribed from topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from topic ${topic}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send notification to a topic
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        topic,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Notification sent to topic ${topic}: ${response}`);

      return response;
    } catch (error) {
      this.logger.error(`Failed to send to topic ${topic}`, error.stack);
      throw error;
    }
  }
}
