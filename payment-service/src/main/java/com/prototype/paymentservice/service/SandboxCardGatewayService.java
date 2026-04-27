package com.prototype.paymentservice.service;

import com.prototype.paymentservice.dto.CardTopupRequest;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.util.UUID;

@Service
public class SandboxCardGatewayService {

    public CardPaymentResult charge(CardTopupRequest request) {
        String number = digitsOnly(request.cardNumber());
        String cvv = digitsOnly(request.cvv());
        String monthText = request.expiryMonth() == null ? "" : request.expiryMonth().trim();
        String yearText = request.expiryYear() == null ? "" : request.expiryYear().trim();

        if (number.length() < 13 || number.length() > 19) {
            return CardPaymentResult.declined("invalid_number", "Card number must be 13 to 19 digits.", last4(number));
        }
        if (!isLuhnValid(number)) {
            return CardPaymentResult.declined("invalid_number", "Card number is not valid.", last4(number));
        }
        if (!cvv.matches("\\d{3,4}")) {
            return CardPaymentResult.declined("invalid_cvv", "Security code (CVV) is invalid.", last4(number));
        }

        int month;
        int year;
        try {
            month = Integer.parseInt(monthText);
            year = Integer.parseInt(yearText);
        } catch (NumberFormatException ex) {
            return CardPaymentResult.declined("invalid_expiry", "Expiry month or year is invalid.", last4(number));
        }

        if (month < 1 || month > 12) {
            return CardPaymentResult.declined("invalid_expiry", "Expiry month must be between 1 and 12.", last4(number));
        }

        // Supports YY and YYYY inputs.
        if (year < 100) {
            year += 2000;
        }
        YearMonth expiry = YearMonth.of(year, month);
        if (expiry.isBefore(YearMonth.now())) {
            return CardPaymentResult.declined("expired_card", "Card is expired.", last4(number));
        }

        // Sandbox decline cards inspired by common payment sandbox patterns.
        if ("4000000000000002".equals(number)) {
            return CardPaymentResult.declined("insufficient_funds", "Card was declined: insufficient funds.", last4(number));
        }
        if ("4000000000009995".equals(number)) {
            return CardPaymentResult.declined("stolen_card", "Card was declined for security reasons.", last4(number));
        }

        String reference = "SBX-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        return CardPaymentResult.approved(reference, last4(number));
    }

    private String digitsOnly(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private boolean isLuhnValid(String number) {
        int sum = 0;
        boolean shouldDouble = false;
        for (int i = number.length() - 1; i >= 0; i--) {
            int digit = number.charAt(i) - '0';
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        return sum % 10 == 0;
    }

    private String last4(String number) {
        if (number == null || number.isBlank()) {
            return "";
        }
        return number.length() <= 4 ? number : number.substring(number.length() - 4);
    }

    public record CardPaymentResult(
        boolean approved,
        String gatewayReference,
        String statusCode,
        String message,
        String cardLast4
    ) {
        static CardPaymentResult approved(String gatewayReference, String cardLast4) {
            return new CardPaymentResult(true, gatewayReference, "approved", "Payment approved in sandbox.", cardLast4);
        }

        static CardPaymentResult declined(String statusCode, String message, String cardLast4) {
            return new CardPaymentResult(false, null, statusCode, message, cardLast4);
        }
    }
}
