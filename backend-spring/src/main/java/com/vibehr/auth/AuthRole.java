package com.vibehr.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "auth_roles")
public class AuthRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(nullable = false, length = 40)
    private String code;
    @Column(nullable = false, length = 60)
    private String name;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected AuthRole() {
    }

    public AuthRole(String code, String name, LocalDateTime createdAt) {
        this.code = code;
        this.name = name;
        this.createdAt = createdAt;
    }

    public Integer getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
