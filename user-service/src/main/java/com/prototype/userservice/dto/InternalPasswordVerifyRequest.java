package com.prototype.userservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record InternalPasswordVerifyRequest(
    @NotNull Long userId,
    @NotBlank String password
) {}
