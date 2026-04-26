package com.prototype.userservice.dto;

public record UserSummary(Long id, String username, String role, boolean active) {}